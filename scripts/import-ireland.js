const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => { const [k,...v] = l.split('='); if(k && v.length) process.env[k.trim()] = v.join('=').trim(); });
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Wikidata SPARQL queries for Irish historical sites
const queries = [
  {
    name: 'Irish Castles',
    category: 'medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31/wdt:P279* wd:Q23413 .
      ?item wdt:P17 wd:Q22 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Northern Ireland Castles',
    category: 'medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31/wdt:P279* wd:Q23413 .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P131* ?region .
      ?region wdt:P131* wd:Q26 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Irish Abbeys & Monasteries',
    category: 'religious',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q160742 wd:Q44613 wd:Q2977 wd:Q317557 }
      ?item wdt:P31/wdt:P279* ?type .
      ?item wdt:P17 wd:Q22 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Irish Round Towers',
    category: 'religious',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31/wdt:P279* wd:Q1072567 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Irish Megalithic Tombs & Archaeological Sites',
    category: 'prehistoric',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q839954 wd:Q1517701 wd:Q1311670 wd:Q328505 wd:Q205495 wd:Q1371300 }
      ?item wdt:P31/wdt:P279* ?type .
      ?item wdt:P17 wd:Q22 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Irish National Monuments',
    category: 'heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q1757129 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Irish Churches & Cathedrals',
    category: 'religious',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q2977 wd:Q16970 }
      ?item wdt:P31/wdt:P279* ?type .
      ?item wdt:P17 wd:Q22 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  },
  {
    name: 'Historic Buildings Ireland (protected structures)',
    category: 'heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q1424620 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`
  }
];

function parseCoord(coordStr) {
  // Point(lng lat) format
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

async function runQuery(q) {
  const url = 'https://query.wikidata.org/sparql';
  const params = new URLSearchParams({ query: q.sparql, format: 'json' });
  
  const res = await fetch(`${url}?${params}`, {
    headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
  });
  
  if (!res.ok) {
    console.error(`  Query failed: ${res.status} ${res.statusText}`);
    return [];
  }
  
  const data = await res.json();
  const results = [];
  const seen = new Set();
  
  for (const binding of data.results.bindings) {
    const name = binding.itemLabel?.value;
    const coordStr = binding.coord?.value;
    if (!name || !coordStr) continue;
    
    const coord = parseCoord(coordStr);
    if (!coord) continue;
    
    const wikidataId = binding.item?.value?.split('/').pop();
    if (seen.has(wikidataId)) continue;
    seen.add(wikidataId);
    
    // Skip if name looks like a Wikidata ID (Q12345)
    if (/^Q\d+$/.test(name)) continue;
    
    const imageUrl = binding.image?.value || '';
    const wikiArticle = binding.article?.value || '';
    const desc = binding.desc?.value || '';
    
    // Determine country from coordinates
    const country = (coord.lat > 54.0 && coord.lng > -8.2 && coord.lng < -5.4) ? 'Northern Ireland' : 'Ireland';
    
    results.push({
      wikidataId,
      name,
      lat: coord.lat,
      lng: coord.lng,
      category: q.category,
      imageUrl: imageUrl ? imageUrl.replace(/\/\d+px-/, '/500px-') : '',
      wikiUrl: wikiArticle || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
      description: desc,
      country
    });
  }
  
  return results;
}

async function run() {
  console.log('=== Ireland Historical Sites Import ===\n');
  
  // Get existing site names to avoid duplicates
  const existing = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland') OR (lat BETWEEN 51.4 AND 55.4 AND lng BETWEEN -10.5 AND -5.5)`;
  const existingNames = new Set(existing.map(r => r.name));
  console.log(`Existing Ireland sites: ${existingNames.size}\n`);
  
  // Get or create source
  let sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'wikidata-ireland'`;
  if (sourceRows.length === 0) {
    sourceRows = await sql`INSERT INTO hg_sources (name, display_name, url) VALUES ('wikidata-ireland', 'Wikidata (Ireland)', 'https://www.wikidata.org') RETURNING id`;
  }
  const sourceId = sourceRows[0].id;
  
  let allSites = [];
  const globalSeen = new Set();
  
  for (const q of queries) {
    console.log(`Querying: ${q.name}...`);
    const sites = await runQuery(q);
    
    // Deduplicate against previous queries
    const newSites = sites.filter(s => {
      const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)},${s.name.toLowerCase()}`;
      if (globalSeen.has(key)) return false;
      globalSeen.add(key);
      return true;
    });
    
    console.log(`  Found: ${sites.length} (${newSites.length} new)`);
    allSites.push(...newSites);
    await sleep(2000); // Be nice to Wikidata
  }
  
  // Filter out existing
  const toInsert = allSites.filter(s => !existingNames.has(s.name.toLowerCase()));
  console.log(`\nTotal unique sites: ${allSites.length}`);
  console.log(`After dedup with existing: ${toInsert.length} to insert\n`);
  
  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i++) {
    const s = toInsert[i];
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + s.wikidataId},
        ${s.name},
        ${s.lat},
        ${s.lng},
        ${s.category},
        ${s.category === 'medieval' ? 'Medieval' : s.category === 'prehistoric' ? 'Prehistoric' : s.category === 'religious' ? 'Religious' : 'Heritage'},
        ${s.description || `Historical site in ${s.country}`},
        ${s.wikiUrl},
        ${s.imageUrl},
        ${s.country},
        ${3},
        ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      // Skip duplicates
      if (!e.message?.includes('duplicate')) {
        console.error(`  Error inserting ${s.name}: ${e.message}`);
      }
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`${i + 1}/${toInsert.length} inserted (${inserted} success)`);
    }
  }
  
  console.log(`\n✅ Done! Inserted ${inserted} Irish sites`);
  
  // Final count
  const total = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland')`;
  const withImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland') AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`Ireland total: ${total[0].total} sites (${withImg[0].total} with images)`);
}

run().catch(e => console.error(e));
