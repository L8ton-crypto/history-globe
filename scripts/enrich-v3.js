/**
 * Enrich v3 - Direct Wikidata API + Wikipedia summary combo
 * For each weak-description site:
 * 1. Try Wikipedia summary API using wiki_url
 * 2. If that fails, use Wikidata entity API to get English description + sitelinks
 * 3. If Wikidata gives us an English Wikipedia link, try that
 */
const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWikiSummary(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation') return null;
    return (data.extract && data.extract.length > 20) ? data.extract : null;
  } catch { return null; }
}

async function fetchWikidataInfo(qid) {
  try {
    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=descriptions|sitelinks&languages=en&sitefilter=enwiki&format=json`, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
    });
    if (!res.ok) return {};
    const data = await res.json();
    const entity = data.entities?.[qid];
    const desc = entity?.descriptions?.en?.value || null;
    const enTitle = entity?.sitelinks?.enwiki?.title || null;
    return { desc, enTitle };
  } catch { return {}; }
}

async function run() {
  console.log('=== Description Enrichment v3 ===\n');

  const sites = await sql`
    SELECT id, name, country, wiki_url, external_id
    FROM hg_sites
    WHERE (
      short_description LIKE 'Historical site in %'
      OR short_description IS NULL
      OR short_description = ''
    )
    AND external_id IS NOT NULL
    AND external_id LIKE 'wd-%'
    ORDER BY id`;

  console.log(`Sites to enrich: ${sites.length}\n`);

  let wikiHit = 0;
  let wdHit = 0;
  let miss = 0;

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const qid = s.external_id.replace('wd-', '');
    let desc = null;

    // Step 1: Ask Wikidata for the English Wikipedia title + description
    const wdInfo = await fetchWikidataInfo(qid);
    
    // Step 2: If Wikidata knows an English Wikipedia article, get the full summary
    if (wdInfo.enTitle) {
      desc = await fetchWikiSummary(wdInfo.enTitle);
      if (desc) wikiHit++;
    }

    // Step 3: Fall back to Wikidata description (short but better than "Historical site in X")
    if (!desc && wdInfo.desc && wdInfo.desc.length > 10) {
      // Capitalize first letter and add context
      desc = wdInfo.desc.charAt(0).toUpperCase() + wdInfo.desc.slice(1);
      if (!desc.endsWith('.')) desc += '.';
      wdHit++;
    }

    if (desc) {
      const truncated = desc.length > 490 ? desc.substring(0, 487) + '...' : desc;
      try {
        await sql`UPDATE hg_sites SET short_description = ${truncated} WHERE id = ${s.id}`;
      } catch {}
    } else {
      miss++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${sites.length} — wiki: ${wikiHit}, wikidata: ${wdHit}, miss: ${miss}`);
    }
    await sleep(150);
  }

  console.log(`\n✅ Done!`);
  console.log(`  Wikipedia summaries: ${wikiHit}`);
  console.log(`  Wikidata descriptions: ${wdHit}`);
  console.log(`  No description found: ${miss}`);

  const remaining = await sql`
    SELECT COUNT(*) as c FROM hg_sites
    WHERE short_description LIKE 'Historical site in %'
    OR short_description IS NULL OR short_description = ''`;
  console.log(`Remaining weak: ${remaining[0].c}`);
}
run().catch(console.error);
