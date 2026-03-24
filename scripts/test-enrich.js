const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  // Get 5 sample weak sites
  const samples = await sql`
    SELECT id, name, country, wiki_url, external_id, short_description
    FROM hg_sites
    WHERE (short_description LIKE 'Historical site in %' OR short_description = '')
    AND external_id LIKE 'wd-%'
    LIMIT 5`;

  for (const s of samples) {
    console.log(`\n--- ${s.name} (${s.country}) ---`);
    console.log(`  external_id: ${s.external_id}`);
    console.log(`  wiki_url: ${s.wiki_url}`);
    console.log(`  current desc: "${s.short_description}"`);

    // Test Wikidata API
    const qid = s.external_id.replace('wd-', '');
    const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=descriptions|sitelinks&languages=en&sitefilter=enwiki&format=json`;
    console.log(`  Wikidata URL: ${wdUrl}`);
    
    try {
      const res = await fetch(wdUrl, { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
      console.log(`  Wikidata status: ${res.status}`);
      const data = await res.json();
      const entity = data.entities?.[qid];
      console.log(`  WD desc: ${entity?.descriptions?.en?.value || 'NONE'}`);
      console.log(`  WD enwiki: ${entity?.sitelinks?.enwiki?.title || 'NONE'}`);
    } catch (e) {
      console.log(`  WD error: ${e.message}`);
    }

    // Test Wikipedia
    const wikiTitle = s.wiki_url?.match(/\/wiki\/(.+)/)?.[1];
    if (wikiTitle) {
      try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`, { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
        console.log(`  Wikipedia status: ${res.status}`);
        if (res.ok) {
          const data = await res.json();
          console.log(`  Wikipedia extract: "${data.extract?.substring(0, 100)}..."`);
        }
      } catch (e) {
        console.log(`  Wiki error: ${e.message}`);
      }
    }
  }
}
run().catch(console.error);
