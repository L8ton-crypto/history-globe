/**
 * Gently fetch images for key sites with very slow rate limiting
 * Run after Wikipedia rate limit resets
 */
import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const sites = await sql`
    SELECT id, name, wiki_url FROM hg_sites
    WHERE (image_url = '' OR image_url IS NULL)
      AND wiki_url IS NOT NULL AND wiki_url != ''
      AND significance >= 3
    ORDER BY significance DESC, 
      CASE WHEN country = 'Wales' THEN 0 ELSE 1 END
    LIMIT 200
  `;

  console.log(`High-significance sites without images: ${sites.length}`);
  let found = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const title = site.wiki_url?.split('/wiki/')?.pop();
    if (!title) continue;

    try {
      const resp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
        { headers: { 'User-Agent': 'HistoryGlobe/1.0' } }
      );

      if (resp.status === 429) {
        console.log(`  Rate limited at ${i}. Waiting 60s...`);
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }

      if (resp.ok) {
        const data = await resp.json();
        if (data.thumbnail?.source) {
          await sql`UPDATE hg_sites SET image_url = ${data.thumbnail.source} WHERE id = ${site.id}`;
          await sql`INSERT INTO hg_site_images (site_id, image_url, thumbnail_url) VALUES (${site.id}, ${data.thumbnail.source}, ${data.thumbnail.source}) ON CONFLICT (site_id) DO UPDATE SET image_url = ${data.thumbnail.source}, fetched_at = NOW()`;
          found++;
        }
      }
    } catch {}

    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${sites.length} - Found: ${found}`);
    await new Promise(r => setTimeout(r, 2000)); // 1 request per 2 seconds - very gentle
  }

  console.log(`\n✅ Found ${found} images`);
}
main().catch(console.error);
