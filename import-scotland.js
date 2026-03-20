const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const queries = [
  {
    name: 'Scottish Castles',
    category: 'medieval',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q23413 .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 800`
  },
  {
    name: 'Scottish Tower Houses',
    category: 'medieval',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q1331783 .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'Scottish Abbeys & Monasteries',
    category: 'religious',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q160742 wd:Q44613 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Scottish Cathedrals & Churches',
    category: 'religious',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16970 wd:Q317557 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Scottish Brochs',
    category: 'ancient',
    era: 'Iron Age',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q850026 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Scottish Stone Circles & Megalithic',
    category: 'ancient',
    era: 'Neolithic / Bronze Age',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q207694 wd:Q839954 wd:Q1311670 wd:Q1517701 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Historic Environment Scotland properties',
    category: 'cultural',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      { ?item wdt:P137 wd:Q1631079 } UNION { ?item wdt:P127 wd:Q1631079 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'Scottish Scheduled Monuments (notable)',
    category: 'ancient',
    era: 'Various',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q2016824 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'Scottish Battlefields',
    category: 'cultural',
    era: 'Various',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q178561 .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  },
  {
    name: 'Scottish Palaces & Stately Homes',
    category: 'medieval',
    era: 'Renaissance',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16560 wd:Q1343246 wd:Q2087181 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER(geof:latitude(?coord) > 54.7)
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  }
];

function parseCoord(coordStr) {
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

function guessCategory(name, desc, defaultCat) {
  const text = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|tower|palace|manor|hall/i.test(text) && defaultCat !== 'ancient') return 'medieval';
  if (/church|abbey|priory|chapel|cathedral|monastery/i.test(text)) return 'religious';
  if (/broch|stone circle|cairn|barrow|hillfort|neolithic|bronze|iron age|megalith|standing stone/i.test(text)) return 'ancient';
  if (/battle|war|military/i.test(text)) return 'cultural';
  if (/mill|mine|bridge|canal|railway|industrial/i.test(text)) return 'industrial';
  return defaultCat;
}

async function run() {
  console.log('=== Scotland Import ===\n');
  
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Existing wikidata sites: ${existingIds.size}\n`);
  
  let sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'historic_scotland'`;
  const sourceId = sourceRows[0].id;
  
  let allResults = [];
  const globalSeen = new Set();
  
  for (const q of queries) {
    console.log(`Querying: ${q.name}...`);
    try {
      const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: q.sparql, format: 'json' })}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' } });
      
      if (!res.ok) { console.log(`  Failed: ${res.status}`); await sleep(3000); continue; }
      
      const data = await res.json();
      let count = 0;
      
      for (const b of data.results.bindings) {
        const name = b.itemLabel?.value;
        const coordStr = b.coord?.value;
        if (!name || !coordStr || /^Q\d+$/.test(name)) continue;
        
        const coord = parseCoord(coordStr);
        if (!coord) continue;
        
        const wikidataId = b.item?.value?.split('/').pop();
        if (globalSeen.has(wikidataId)) continue;
        globalSeen.add(wikidataId);
        
        if (existingIds.has('wd-' + wikidataId)) continue;
        
        const desc = b.desc?.value || '';
        const imageUrl = b.image?.value ? b.image.value.replace(/\/\d+px-/, '/500px-') : '';
        const wikiUrl = b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
        const category = guessCategory(name, desc, q.category);
        
        allResults.push({
          extId: 'wd-' + wikidataId, wikidataId, name,
          lat: coord.lat, lng: coord.lng,
          category, era: q.era, description: desc || 'Historical site in Scotland',
          imageUrl, wikiUrl
        });
        count++;
      }
      
      console.log(`  Found: ${count} new sites`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    await sleep(3000);
  }
  
  console.log(`\nTotal to insert: ${allResults.length}\n`);
  
  let inserted = 0, skipped = 0;
  for (let i = 0; i < allResults.length; i++) {
    const s = allResults[i];
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${s.extId}, ${s.name}, ${s.lat}, ${s.lng},
        ${s.category}, ${s.era}, ${s.description},
        ${s.wikiUrl}, ${s.imageUrl}, ${'Scotland'}, ${3}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      skipped++;
      if (skipped <= 5) console.log(`  Skip: ${s.name}: ${e.message?.substring(0, 60)}`);
    }
    if ((i + 1) % 100 === 0) console.log(`${i + 1}/${allResults.length} (${inserted} inserted, ${skipped} skipped)`);
  }
  
  console.log(`\n✅ Inserted ${inserted} Scottish sites (${skipped} skipped)`);
  
  await sql`UPDATE hg_sources SET site_count = ${inserted}, last_imported_at = NOW() WHERE id = ${sourceId}`;
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const scotTotal = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'Scotland'`;
  const scotImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'Scotland' AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`\nScotland: ${scotTotal[0].total} sites (${scotImg[0].total} with images)`);
  console.log(`Grand total: ${grand[0].total} sites`);
}

run().catch(e => console.error(e));
