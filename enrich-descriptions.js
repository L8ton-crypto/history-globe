const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getWikiExtract(title) {
  const cleanTitle = decodeURIComponent(title.split('/wiki/').pop() || title);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`;
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.status === 429) return null; // rate limited
    if (!res.ok) return null;
    const data = await res.json();
    if (data.extract && data.extract.length > 30) {
      return data.extract;
    }
  } catch {}
  return null;
}

async function run() {
  // Get sites with poor descriptions
  const rows = await sql`
    SELECT id, name, wiki_url, short_description FROM hg_sites 
    WHERE (
      short_description LIKE 'Grade I%' 
      OR short_description LIKE 'Historical site%'
      OR short_description LIKE 'Historic site%'
      OR short_description IS NULL 
      OR short_description = ''
      OR LENGTH(short_description) < 20
    )
    AND wiki_url IS NOT NULL AND wiki_url != ''
    ORDER BY significance DESC, id
  `;
  
  console.log(`=== Description Enrichment ===`);
  console.log(`Sites with poor descriptions: ${rows.length}\n`);
  
  let enriched = 0, failed = 0, rateLimited = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const extract = await getWikiExtract(row.wiki_url);
    
    if (extract === null && rateLimited < 3) {
      // Might be rate limited, slow down
      rateLimited++;
      await sleep(2000);
      continue;
    }
    
    if (extract) {
      // Use first ~500 chars as short description
      const shortDesc = extract.length > 500 ? extract.substring(0, 497) + '...' : extract;
      // If extract is longer, put full thing in long_description
      const longDesc = extract.length > 500 ? extract : '';
      
      await sql`UPDATE hg_sites SET 
        short_description = ${shortDesc},
        long_description = CASE WHEN ${longDesc} != '' THEN ${longDesc} ELSE long_description END
        WHERE id = ${row.id}`;
      enriched++;
    } else {
      failed++;
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`${i + 1}/${rows.length} - Enriched: ${enriched} | Failed: ${failed}`);
    }
    
    // Wikipedia rate limit: ~200 req/sec but let's be conservative
    await sleep(100);
  }
  
  console.log(`\n✅ Done! Enriched: ${enriched} | Failed: ${failed}`);
  
  // Recheck
  const remaining = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE short_description LIKE 'Grade I%' OR short_description LIKE 'Historical site%' OR short_description IS NULL OR short_description = '' OR LENGTH(short_description) < 20`;
  console.log(`Remaining poor descriptions: ${remaining[0].total}`);
}

run().catch(e => console.error(e));
