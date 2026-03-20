/**
 * Fill image gaps using Geograph UK - geo-tagged photos of British/Irish sites
 * Uses coordinate proximity search - no name matching needed!
 * API key: geo_kSjuKEQR (free tier)
 */
import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function findGeographImage(lat: number, lng: number, name: string): Promise<string | null> {
  try {
    const url = `https://api.geograph.org.uk/syndicator.php?key=geo_kSjuKEQR&location=${lat},${lng}&distance=0.3&format=JSON&perpage=5`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
    if (!resp.ok) return null;
    
    const data = await resp.json();
    if (!data.items || data.items.length === 0) return null;

    // Try to find a photo matching the site name
    const nameLower = name.toLowerCase();
    let bestPhoto = data.items[0]; // default to nearest
    
    for (const item of data.items) {
      const title = (item.title || '').toLowerCase();
      // Prefer photos that mention the site name
      if (title.includes(nameLower.split(' ')[0]) || title.includes('castle') && nameLower.includes('castle') || title.includes('abbey') && nameLower.includes('abbey')) {
        bestPhoto = item;
        break;
      }
    }

    // Convert 120x120 thumb to full size
    const thumb = bestPhoto.thumb;
    if (!thumb) return null;
    
    // Remove _120x120 to get medium/full size
    const fullUrl = thumb.replace('_120x120', '_213x160');
    return fullUrl;
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Geograph Image Enrichment ===\n');

  // Get UK/Ireland sites without images, prioritise by significance
  const sites = await sql`
    SELECT id, name, lat, lng, significance FROM hg_sites
    WHERE (image_url = '' OR image_url IS NULL)
      AND country IN ('Wales', 'England', 'Scotland', 'Northern Ireland', 'Ireland')
      AND significance >= 2
    ORDER BY significance DESC,
      CASE WHEN name ILIKE '%castle%' THEN 0
           WHEN name ILIKE '%abbey%' OR name ILIKE '%priory%' THEN 1
           WHEN name ILIKE '%fort%' OR name ILIKE '%roman%' THEN 2
           WHEN name ILIKE '%church%' OR name ILIKE '%cathedral%' THEN 3
           ELSE 4 END
    LIMIT 1000
  `;

  console.log(`Sites to search: ${sites.length}`);
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const imageUrl = await findGeographImage(site.lat, site.lng, site.name);

    if (imageUrl) {
      await sql`UPDATE hg_sites SET image_url = ${imageUrl} WHERE id = ${site.id}`;
      await sql`
        INSERT INTO hg_site_images (site_id, image_url, thumbnail_url, attribution)
        VALUES (${site.id}, ${imageUrl}, ${imageUrl}, 'Geograph Britain and Ireland (CC BY-SA 2.0)')
        ON CONFLICT (site_id) DO UPDATE SET image_url = ${imageUrl}, attribution = 'Geograph Britain and Ireland (CC BY-SA 2.0)', fetched_at = NOW()
      `;
      found++;
    } else {
      notFound++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${sites.length} - Found: ${found} | Not found: ${notFound}`);
    }

    await new Promise(r => setTimeout(r, 300)); // gentle rate limit
  }

  const walesImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND image_url != '' AND image_url IS NOT NULL`;
  const totalImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE image_url != '' AND image_url IS NOT NULL`;

  console.log(`\n✅ Done!`);
  console.log(`   New images from Geograph: ${found}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Welsh images total: ${walesImg[0].c}`);
  console.log(`   All images total: ${totalImg[0].c}`);
}
main().catch(console.error);
