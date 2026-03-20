const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const queries = [
  // USA - National Historic Landmarks
  {
    name: 'US National Historic Landmarks',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q15243209 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 3000`
  },
  // USA - National Monuments
  {
    name: 'US National Monuments',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q1187580 .
      ?item wdt:P17 wd:Q30 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  // USA - National Battlefields & Military Parks
  {
    name: 'US Battlefields & Military Parks',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q2895602 wd:Q3291946 wd:Q1684073 }
      ?item wdt:P31 ?type .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // USA - National Historic Sites (NPS)
  {
    name: 'US National Historic Sites (NPS)',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q3116778 .
      ?item wdt:P17 wd:Q30 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // USA - Historic forts
  {
    name: 'US Historic Forts',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q57821 .
      ?item wdt:P17 wd:Q30 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  // USA - Notable castles & mansions
  {
    name: 'US Castles & Historic Mansions',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q23413 wd:Q879050 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q30 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // USA - Native American / archaeological
  {
    name: 'US Archaeological Sites',
    country: 'United States',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q839954 wd:Q1311670 wd:Q744913 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q30 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // Canada - National Historic Sites
  {
    name: 'Canadian National Historic Sites',
    country: 'Canada',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q1568856 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 1500`
  },
  // Canada - Historic forts & castles
  {
    name: 'Canadian Forts & Castles',
    country: 'Canada',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q57821 wd:Q23413 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q16 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  // Canada - Churches & Cathedrals
  {
    name: 'Canadian Churches & Cathedrals',
    country: 'Canada',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16970 wd:Q317557 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q16 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
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

function guessCategory(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|fortress|stockade|blockhouse|barracks/i.test(text)) return 'medieval';
  if (/church|cathedral|chapel|abbey|priory|monastery|mission|basilica/i.test(text)) return 'religious';
  if (/battle|military|war|army|navy|memorial/i.test(text)) return 'cultural';
  if (/archaeological|pueblo|mound|petroglyph|cliff dwelling|native|indigenous|prehistoric/i.test(text)) return 'ancient';
  if (/roman/i.test(text)) return 'roman';
  if (/mill|mine|bridge|canal|railway|lighthouse|harbour|dam|factory|industrial/i.test(text)) return 'industrial';
  if (/park|monument|canyon|volcano|cave|reef|forest|wilderness|desert|glacier|geyser/i.test(text)) return 'natural';
  return 'cultural';
}

async function run() {
  console.log('=== North America Import ===\n');
  
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
          description: desc || `Historic site in ${q.country}`,
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
      if (skipped <= 3) console.log(`  Skip: ${s.name}: ${e.message?.substring(0, 60)}`);
    }
    if ((i + 1) % 100 === 0) console.log(`${i + 1}/${allResults.length} (${inserted} inserted, ${skipped} skipped)`);
  }
  
  console.log(`\n✅ Inserted ${inserted} North American sites (${skipped} skipped)`);
  
  // Stats
  for (const c of ['United States', 'Canada']) {
    const t = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c}`;
    const img = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c} AND image_url IS NOT NULL AND image_url != ''`;
    console.log(`${c}: ${t[0].total} sites, ${img[0].total} with images (${((img[0].total/t[0].total)*100).toFixed(0)}%)`);
  }
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const grandImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\nGrand total: ${grand[0].total} sites, ${grandImg[0].total} with images (${((grandImg[0].total/grand[0].total)*100).toFixed(1)}%)`);
}

run().catch(e => console.error(e));
