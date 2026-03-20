import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Get Welsh sites without images, prioritise by significance and castle/fort types
  const sites = await sql`
    SELECT id, name, wiki_url FROM hg_sites
    WHERE country = 'Wales'
      AND (image_url = '' OR image_url IS NULL)
      AND wiki_url IS NOT NULL AND wiki_url != ''
    ORDER BY significance DESC, 
      CASE WHEN name ILIKE '%castle%' THEN 0
           WHEN name ILIKE '%abbey%' THEN 1
           WHEN name ILIKE '%priory%' THEN 2
           WHEN name ILIKE '%fort%' THEN 3
           WHEN name ILIKE '%roman%' THEN 4
           ELSE 5 END,
      id
    LIMIT 500
  `;

  console.log(`Welsh sites without images to check: ${sites.length}`);
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const title = site.wiki_url?.split('/wiki/')?.pop();
    if (!title) { notFound++; continue; }

    try {
      const resp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'HistoryGlobe/1.0' } }
      );

      if (resp.ok) {
        const data = await resp.json();
        const imageUrl = data.thumbnail?.source || data.originalimage?.source;
        
        if (imageUrl) {
          await sql`UPDATE hg_sites SET image_url = ${imageUrl} WHERE id = ${site.id}`;
          await sql`
            INSERT INTO hg_site_images (site_id, image_url, thumbnail_url)
            VALUES (${site.id}, ${imageUrl}, ${imageUrl})
            ON CONFLICT (site_id) DO UPDATE SET image_url = ${imageUrl}, thumbnail_url = ${imageUrl}, fetched_at = NOW()
          `;
          found++;
        } else {
          notFound++;
        }
      } else {
        notFound++;
      }
    } catch {
      notFound++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${sites.length} - Found: ${found} | Not found: ${notFound}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const total = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND image_url != '' AND image_url IS NOT NULL`;
  console.log(`\n✅ Done! New images found: ${found}`);
  console.log(`Welsh sites with images now: ${total[0].c}`);
}
main().catch(console.error);
