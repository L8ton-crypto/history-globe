/**
 * Image Enrichment Script
 * Fetches Wikipedia thumbnail images for all sites and caches in hg_site_images
 * Run: npx tsx scripts/enrich-images.ts
 * 
 * Rate limits: ~50 req/s to Wikipedia API (they're generous but be polite)
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

interface WikiResponse {
  thumbnail?: { source: string };
  originalimage?: { source: string };
  extract?: string;
  title?: string;
}

async function fetchWikiImage(title: string): Promise<{ imageUrl: string | null; extract: string | null }> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: {
          'User-Agent': 'HistoryGlobe/1.0 (https://history-globe-sigma.vercel.app; enrichment script)',
        },
      }
    );

    if (!response.ok) {
      return { imageUrl: null, extract: null };
    }

    const data: WikiResponse = await response.json();
    return {
      imageUrl: data.thumbnail?.source || data.originalimage?.source || null,
      extract: data.extract || null,
    };
  } catch {
    return { imageUrl: null, extract: null };
  }
}

function extractWikiTitle(wikiUrl: string): string | null {
  if (!wikiUrl) return null;
  const match = wikiUrl.match(/\/wiki\/(.+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

async function main() {
  console.log('=== HistoryGlobe Image Enrichment ===\n');

  // Get sites that don't have cached images yet
  const sites = await sql`
    SELECT s.id, s.name, s.wiki_url, s.short_description
    FROM hg_sites s
    LEFT JOIN hg_site_images i ON s.id = i.site_id
    WHERE i.id IS NULL
      AND s.wiki_url IS NOT NULL
      AND s.wiki_url != ''
    ORDER BY s.significance DESC, s.id
  `;

  console.log(`Sites needing images: ${sites.length}`);

  let processed = 0;
  let found = 0;
  let notFound = 0;
  let errors = 0;

  // Process in batches with rate limiting
  const batchSize = 10; // concurrent requests
  const delayMs = 200; // delay between batches

  for (let i = 0; i < sites.length; i += batchSize) {
    const batch = sites.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (site) => {
        const title = extractWikiTitle(site.wiki_url);
        if (!title) return { siteId: site.id, imageUrl: null, extract: null };

        const { imageUrl, extract } = await fetchWikiImage(title);
        return { siteId: site.id, imageUrl, extract, name: site.name };
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        errors++;
        continue;
      }

      const { siteId, imageUrl, extract } = result.value;

      try {
        if (imageUrl) {
          // Cache the image
          await sql`
            INSERT INTO hg_site_images (site_id, image_url, thumbnail_url)
            VALUES (${siteId}, ${imageUrl}, ${imageUrl})
            ON CONFLICT (site_id) DO UPDATE SET
              image_url = ${imageUrl},
              thumbnail_url = ${imageUrl},
              fetched_at = NOW()
          `;

          // Also update the site's image_url directly for faster access
          await sql`
            UPDATE hg_sites SET image_url = ${imageUrl} WHERE id = ${siteId}
          `;

          // If we got a better description from Wikipedia, update it
          if (extract && extract.length > 50) {
            await sql`
              UPDATE hg_sites SET 
                short_description = ${extract.substring(0, 300)},
                long_description = ${extract}
              WHERE id = ${siteId}
                AND (short_description IS NULL OR short_description LIKE 'A %in %, Wales.%' OR short_description LIKE 'A %in %, Wales. Classified%')
            `;
          }

          found++;
        } else {
          // Record that we tried (insert with null so we don't retry)
          await sql`
            INSERT INTO hg_site_images (site_id, image_url, thumbnail_url)
            VALUES (${siteId}, NULL, NULL)
            ON CONFLICT (site_id) DO NOTHING
          `;
          notFound++;
        }
      } catch (e: any) {
        errors++;
      }

      processed++;
    }

    // Progress update
    if ((i + batchSize) % 100 === 0 || i + batchSize >= sites.length) {
      const pct = Math.round((processed / sites.length) * 100);
      console.log(`  ${processed}/${sites.length} (${pct}%) - Found: ${found} | Not found: ${notFound} | Errors: ${errors}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, delayMs));
  }

  // Final stats
  const imageCount = await sql`SELECT COUNT(*) as c FROM hg_site_images WHERE image_url IS NOT NULL`;
  const enrichedDesc = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE long_description NOT LIKE '%Scheduled Ancient Monument%' AND long_description != ''`;

  console.log(`\n✅ Enrichment complete!`);
  console.log(`📊 Results:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Images found: ${found}`);
  console.log(`   No image: ${notFound}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total cached images in DB: ${imageCount[0].c}`);
  console.log(`   Sites with enriched descriptions: ${enrichedDesc[0].c}`);
}

main().catch(console.error);
