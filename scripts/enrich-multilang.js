/**
 * Multi-language description enrichment.
 * Uses the local Wikipedia for each country (fr for France, de for Germany, etc.)
 * Falls back to Wikidata descriptions.
 */
const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const countryLang = {
  'France': ['fr', 'en'],
  'Germany': ['de', 'en'],
  'Austria': ['de', 'en'],
  'Switzerland': ['de', 'fr', 'en'],
  'Italy': ['it', 'en'],
  'Spain': ['es', 'en'],
  'Portugal': ['pt', 'en'],
  'Netherlands': ['nl', 'en'],
  'Belgium': ['nl', 'fr', 'en'],
  'Poland': ['pl', 'en'],
  'Czech Republic': ['cs', 'en'],
  'Denmark': ['da', 'en'],
  'Sweden': ['sv', 'en'],
  'Norway': ['no', 'en'],
  'Hungary': ['hu', 'en'],
  'Romania': ['ro', 'en'],
  'Croatia': ['hr', 'en'],
  'Turkey': ['tr', 'en'],
  'Greece': ['el', 'en'],
  'Egypt': ['ar', 'en'],
};

async function fetchWikidataSitelinks(qid, langs) {
  const sitefilter = langs.map(l => l + 'wiki').join(',');
  const langStr = langs.join(',');
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=descriptions|sitelinks&languages=${langStr}&sitefilter=${sitefilter}&format=json`,
      { headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.entities?.[qid] || null;
  } catch { return null; }
}

async function fetchWikiSummary(lang, title) {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation') return null;
    return (data.extract && data.extract.length > 20) ? data.extract : null;
  } catch { return null; }
}

async function run() {
  console.log('=== Multi-Language Description Enrichment ===\n');

  const sites = await sql`
    SELECT id, name, country, external_id
    FROM hg_sites
    WHERE (
      short_description LIKE 'Historical site in %'
      OR short_description IS NULL
      OR short_description = ''
    )
    AND external_id LIKE 'wd-%'
    ORDER BY country, id`;

  console.log(`Sites to enrich: ${sites.length}\n`);

  let wikiHit = 0;
  let wdDescHit = 0;
  let miss = 0;
  let currentCountry = '';

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const qid = s.external_id.replace('wd-', '');
    const langs = countryLang[s.country] || ['en'];
    
    if (s.country !== currentCountry) {
      if (currentCountry) console.log('');
      currentCountry = s.country;
      console.log(`🌍 ${s.country} (langs: ${langs.join(', ')})`);
    }

    let desc = null;

    // Get Wikidata entity info
    const entity = await fetchWikidataSitelinks(qid, langs);

    if (entity) {
      // Try each language's Wikipedia in order
      for (const lang of langs) {
        const sitekey = lang + 'wiki';
        const title = entity.sitelinks?.[sitekey]?.title;
        if (title) {
          desc = await fetchWikiSummary(lang, title);
          if (desc) { wikiHit++; break; }
        }
        await sleep(50);
      }

      // Fall back to Wikidata description (try each language)
      if (!desc) {
        for (const lang of langs) {
          const wdDesc = entity.descriptions?.[lang]?.value;
          if (wdDesc && wdDesc.length > 10) {
            desc = wdDesc.charAt(0).toUpperCase() + wdDesc.slice(1);
            if (!desc.endsWith('.')) desc += '.';
            wdDescHit++;
            break;
          }
        }
      }
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
      console.log(`  ${i + 1}/${sites.length} — wiki: ${wikiHit}, wd: ${wdDescHit}, miss: ${miss}`);
    }
    await sleep(120);
  }

  console.log(`\n✅ Done!`);
  console.log(`  Wikipedia summaries: ${wikiHit}`);
  console.log(`  Wikidata descriptions: ${wdDescHit}`);
  console.log(`  No description found: ${miss}`);

  const remaining = await sql`
    SELECT COUNT(*) as c FROM hg_sites
    WHERE short_description LIKE 'Historical site in %'
    OR short_description IS NULL OR short_description = ''`;
  console.log(`Remaining weak: ${remaining[0].c}`);
}
run().catch(console.error);
