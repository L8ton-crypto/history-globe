const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const queries = [
  // Isle of Man - Crown dependency, not part of UK, has its own heritage
  {
    name: 'Isle of Man heritage',
    country: 'Isle of Man',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P17 wd:Q9676 .
      ?item wdt:P625 ?coord .
      VALUES ?type { wd:Q23413 wd:Q16970 wd:Q160742 wd:Q44613 wd:Q839954 wd:Q207694 
                     wd:Q12518 wd:Q16560 wd:Q57821 wd:Q751876 wd:Q5107 wd:Q33506 
                     wd:Q3947 wd:Q2087181 wd:Q317557 wd:Q1331783 wd:Q178561 }
      ?item wdt:P31 ?type .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Isle of Man - all with coords and images',
    country: 'Isle of Man',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P17 wd:Q9676 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // Jersey
  {
    name: 'Jersey heritage',
    country: 'Jersey',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P17 wd:Q785 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // Guernsey
  {
    name: 'Guernsey heritage',
    country: 'Guernsey',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P17 wd:Q25230 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // Isle of Wight extras
  {
    name: 'Isle of Wight heritage',
    country: 'England',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P131 wd:Q80 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // Orkney extras (scheduled monuments, brochs)
  {
    name: 'Orkney heritage extras',
    country: 'Scotland',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P131* wd:Q100166 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  },
  // Shetland extras
  {
    name: 'Shetland heritage extras',
    country: 'Scotland',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P131* wd:Q47134 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  }
];

function parseCoord(coordStr) {
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

function guessCategory(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|tower|manor|hall|palace/i.test(text)) return 'medieval';
  if (/church|abbey|priory|chapel|cathedral|monastery/i.test(text)) return 'religious';
  if (/broch|stone circle|cairn|barrow|hillfort|neolithic|bronze|iron|megalith|standing stone|dolmen|tomb|menhir/i.test(text)) return 'ancient';
  if (/roman|villa|amphitheatre/i.test(text)) return 'roman';
  if (/mill|mine|bridge|canal|railway|lighthouse|harbour|pier/i.test(text)) return 'industrial';
  if (/garden|park|nature|coast|cliff|beach|bay/i.test(text)) return 'natural';
  return 'cultural';
}

async function run() {
  console.log('=== British & Irish Islands Import ===\n');
  
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Existing wikidata sites: ${existingIds.size}\n`);
  
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
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
        
        allResults.push({
          extId: 'wd-' + wikidataId, wikidataId, name,
          lat: coord.lat, lng: coord.lng,
          category: guessCategory(name, desc),
          description: desc || `Historical site on ${q.country}`,
          imageUrl, wikiUrl, country: q.country
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
        ${s.category}, ${'Heritage'}, ${s.description},
        ${s.wikiUrl}, ${s.imageUrl}, ${s.country}, ${3}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      skipped++;
    }
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${allResults.length} (${inserted} inserted, ${skipped} skipped)`);
  }
  
  console.log(`\n✅ Inserted ${inserted} island sites (${skipped} skipped)`);
  
  // Stats by country
  const byCountry = {};
  allResults.forEach(s => { byCountry[s.country] = (byCountry[s.country] || 0) + 1; });
  console.log('\nBy location:');
  Object.entries(byCountry).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`\nGrand total: ${grand[0].total} sites`);
}

run().catch(e => console.error(e));
