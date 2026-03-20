/**
 * Fix Welsh site images using Wikipedia search API
 * Instead of guessing URLs, search Wikipedia for the site name
 */
import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function searchWikipedia(query: string): Promise<{ title: string; imageUrl: string | null; extract: string | null } | null> {
  try {
    // Use Wikipedia search to find the right article
    const searchResp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`,
      { headers: { 'User-Agent': 'HistoryGlobe/1.0' } }
    );
    const searchData = await searchResp.json();
    
    if (!searchData[1] || searchData[1].length === 0) return null;
    
    const title = searchData[1][0];
    
    // Now get the summary with image
    const summaryResp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'HistoryGlobe/1.0' } }
    );
    
    if (!summaryResp.ok) return null;
    
    const data = await summaryResp.json();
    return {
      title: data.title,
      imageUrl: data.thumbnail?.source || data.originalimage?.source || null,
      extract: data.extract || null,
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Fix Welsh Images via Wikipedia Search ===\n');

  // Get Welsh sites without images, prioritise notable ones
  const sites = await sql`
    SELECT id, name, significance FROM hg_sites
    WHERE country = 'Wales'
      AND (image_url = '' OR image_url IS NULL)
    ORDER BY 
      CASE WHEN name ILIKE '%castle%' THEN 0
           WHEN name ILIKE '%abbey%' OR name ILIKE '%priory%' THEN 1
           WHEN name ILIKE '%fort%' OR name ILIKE '%roman%' THEN 2
           WHEN name ILIKE '%church%' OR name ILIKE '%chapel%' THEN 3
           ELSE 4 END,
      significance DESC
    LIMIT 500
  `;

  console.log(`Sites to search: ${sites.length}`);
  let found = 0;
  let enrichedDesc = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    
    // Clean up the name for searching - remove Cadw-specific bits
    let searchName = site.name
      .replace(/\(.*?\)/g, '') // remove parenthetical
      .replace(/:.*/g, '')    // remove after colon
      .replace(/,.*$/, '')    // remove after comma (first part is usually the main name)
      .replace(/\s+/g, ' ')
      .trim();
    
    // Add "Wales" to help disambiguate
    const result = await searchWikipedia(searchName + ' Wales');
    
    // If that didn't work, try without "Wales"
    const finalResult = result || await searchWikipedia(searchName);
    
    if (finalResult) {
      if (finalResult.imageUrl) {
        await sql`UPDATE hg_sites SET image_url = ${finalResult.imageUrl}, wiki_url = ${'https://en.wikipedia.org/wiki/' + encodeURIComponent(finalResult.title.replace(/ /g, '_'))} WHERE id = ${site.id}`;
        await sql`
          INSERT INTO hg_site_images (site_id, image_url, thumbnail_url)
          VALUES (${site.id}, ${finalResult.imageUrl}, ${finalResult.imageUrl})
          ON CONFLICT (site_id) DO UPDATE SET image_url = ${finalResult.imageUrl}, fetched_at = NOW()
        `;
        found++;
      }
      
      if (finalResult.extract && finalResult.extract.length > 50) {
        const shortDesc = finalResult.extract.length > 300 ? finalResult.extract.substring(0, 300) + '...' : finalResult.extract;
        await sql`
          UPDATE hg_sites SET short_description = ${shortDesc}, long_description = ${finalResult.extract}
          WHERE id = ${site.id}
        `;
        enrichedDesc++;
      }
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${sites.length} - Images found: ${found} | Descriptions: ${enrichedDesc}`);
    }
    await new Promise(r => setTimeout(r, 150)); // rate limit (2 API calls per site)
  }

  const total = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND image_url != '' AND image_url IS NOT NULL`;
  console.log(`\n✅ Done!`);
  console.log(`   New images: ${found}`);
  console.log(`   Descriptions enriched: ${enrichedDesc}`);
  console.log(`   Total Welsh sites with images: ${total[0].c}`);
}
main().catch(console.error);
