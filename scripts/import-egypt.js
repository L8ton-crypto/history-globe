const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const categoryMap = { 'ancient':'ancient','religious':'religious','medieval':'medieval','cultural':'cultural','roman':'roman' };
function mapCat(c) { return categoryMap[c] || 'cultural'; }

function parseCoord(s) {
  const m = s.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  return m ? { lng: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

// Q79 = Egypt
const jobs = [
  { qname: 'Ancient Egyptian Temples', category: 'ancient', era: 'Ancient Egyptian',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q44539 wd:Q32815 wd:Q1370598 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 500` },
  { qname: 'Pyramids & Tombs', category: 'ancient', era: 'Ancient Egyptian',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q12516 wd:Q381885 wd:Q473862 wd:Q203547 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 500` },
  { qname: 'Archaeological Sites', category: 'ancient', era: 'Ancient',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q839954 . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 500` },
  { qname: 'Mosques', category: 'religious', era: 'Islamic',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q32815 . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 500` },
  { qname: 'Churches & Coptic Sites', category: 'religious', era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16970 wd:Q2977 wd:Q44613 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 300` },
  { qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval / Islamic',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q23413 wd:Q57821 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 300` },
  { qname: 'Roman Sites', category: 'roman', era: 'Roman',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q24354 wd:Q34442 wd:Q41176 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 300` },
  { qname: 'UNESCO Sites', category: 'cultural', era: 'World Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q9259 . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 200` },
  { qname: 'Lighthouses', category: 'cultural', era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q39715 . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 200` },
  { qname: 'Obelisks & Monuments', category: 'ancient', era: 'Ancient Egyptian',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q172891 wd:Q4989906 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q79 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar" }
    } LIMIT 200` },
];

async function run() {
  console.log('=== Egypt Import ===\n');

  const existing = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country = 'Egypt'`;
  const existingNames = new Set(existing.map(r => r.name));
  console.log(`Existing Egypt sites: ${existingNames.size}`);

  let srcRows = await sql`SELECT id FROM hg_sources WHERE name = 'wikidata-egypt'`;
  if (srcRows.length === 0) {
    srcRows = await sql`INSERT INTO hg_sources (name, display_name, url) VALUES ('wikidata-egypt', 'Wikidata (Egypt)', 'https://www.wikidata.org') RETURNING id`;
  }
  const sourceId = srcRows[0].id;

  let allSites = [];
  const seen = new Set();

  for (const job of jobs) {
    console.log(`Querying: ${job.qname}...`);
    const url = 'https://query.wikidata.org/sparql';
    const params = new URLSearchParams({ query: job.sparql, format: 'json' });
    
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${url}?${params}`, {
          headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
        });
        if (res.status === 429) { console.log('  Rate limited, waiting 60s...'); await sleep(60000); continue; }
        if (!res.ok) { console.log(`  Failed: ${res.status}`); await sleep(10000); continue; }
        data = await res.json();
        break;
      } catch (e) { console.log(`  Error: ${e.message}`); await sleep(10000); }
    }
    if (!data?.results) { console.log('  (no results)'); await sleep(5000); continue; }

    for (const b of data.results.bindings) {
      const name = b.itemLabel?.value;
      const coordStr = b.coord?.value;
      if (!name || !coordStr) continue;
      const coord = parseCoord(coordStr);
      if (!coord) continue;
      const wdId = b.item?.value?.split('/').pop();
      if (seen.has(wdId) || /^Q\d+$/.test(name)) continue;
      seen.add(wdId);
      const imgUrl = b.image?.value || '';
      allSites.push({
        wikidataId: wdId, name, lat: coord.lat, lng: coord.lng,
        category: job.category, era: job.era,
        imageUrl: imgUrl ? imgUrl.replace(/\/\d+px-/, '/500px-') : '',
        wikiUrl: b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        description: b.desc?.value || '', country: 'Egypt'
      });
    }
    console.log(`  → ${data.results.bindings.length} raw, ${allSites.length} total unique`);
    await sleep(5000);
  }

  const toInsert = allSites.filter(s => !existingNames.has(s.name.toLowerCase()));
  console.log(`\nUnique: ${allSites.length} | New: ${toInsert.length}`);

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i++) {
    const s = toInsert[i];
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + s.wikidataId}, ${s.name}, ${s.lat}, ${s.lng},
        ${mapCat(s.category)}, ${s.era},
        ${(s.description || 'Historical site in Egypt').substring(0, 490)},
        ${s.wikiUrl}, ${s.imageUrl}, ${'Egypt'}, ${3}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      if (!e.message?.includes('duplicate')) console.error(`  Err: ${s.name}: ${e.message?.substring(0, 60)}`);
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${toInsert.length} (${inserted} inserted)`);
  }

  console.log(`\n✅ Inserted: ${inserted}`);
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Egypt'`;
  const img = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Egypt' AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`Egypt total: ${total[0].c} (${img[0].c} with images)`);
  const grand = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  console.log(`Grand total: ${grand[0].c}`);
}
run().catch(console.error);
