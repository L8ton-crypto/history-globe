const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// US states with Wikidata IDs
const states = [
  ['Q99', 'California'], ['Q1509', 'Virginia'], ['Q1391', 'Massachusetts'],
  ['Q1387', 'New York'], ['Q1400', 'Pennsylvania'], ['Q1439', 'Texas'],
  ['Q1456', 'Florida'], ['Q1166', 'Georgia'], ['Q1428', 'Ohio'],
  ['Q1415', 'North Carolina'], ['Q779', 'Illinois'], ['Q1581', 'Washington'],
  ['Q1393', 'Maryland'], ['Q1536', 'Colorado'], ['Q816', 'Arizona'],
  ['Q1454', 'Louisiana'], ['Q1390', 'Connecticut'], ['Q771', 'South Carolina'],
  ['Q1223', 'Tennessee'], ['Q1408', 'New Jersey'],
  ['Q812', 'Alaska'], ['Q1233', 'Missouri'], ['Q1603', 'Hawaii'],
  ['Q1588', 'Oregon'], ['Q1421', 'Michigan'], ['Q1537', 'Montana'],
  ['Q1258', 'Wisconsin'], ['Q1261', 'Indiana'], ['Q1186', 'Mississippi'],
  ['Q1207', 'Alabama'], ['Q1649', 'Oklahoma'], ['Q131269', 'District of Columbia'],
  ['Q1203', 'Kentucky'], ['Q1261', 'Indiana'], ['Q1546', 'New Mexico'],
  ['Q1500', 'West Virginia'], ['Q1189', 'Arkansas'],
  ['Q797', 'Maine'], ['Q790', 'New Hampshire'], ['Q771', 'Rhode Island'],
  ['Q782', 'Vermont'], ['Q1370', 'Delaware'],
];

function parseCoord(coordStr) {
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

function guessCategory(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|fortress|barracks/i.test(text)) return 'medieval';
  if (/church|cathedral|chapel|abbey|monastery|mission|basilica|synagogue|mosque|temple/i.test(text)) return 'religious';
  if (/battle|military|war|army|navy|memorial|cemetery|veteran/i.test(text)) return 'cultural';
  if (/archaeological|pueblo|mound|petroglyph|cliff dwelling|native|indigenous|prehistoric|ancient|ruins/i.test(text)) return 'ancient';
  if (/mill|mine|bridge|canal|railway|lighthouse|dam|factory|industrial|wharf|dock/i.test(text)) return 'industrial';
  if (/park|canyon|volcano|cave|reef|forest|wilderness|desert|glacier|geyser|lake|mountain|island|crater/i.test(text)) return 'natural';
  return 'cultural';
}

async function run() {
  console.log('=== USA Import by State ===\n');
  
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Existing wikidata sites: ${existingIds.size}\n`);
  
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  
  const globalSeen = new Set();
  let totalInserted = 0, totalSkipped = 0;
  
  for (const [stateQ, stateName] of states) {
    // Query NHL + notable buildings in each state
    const sparql = `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q15243209 .
      ?item wdt:P131* wd:${stateQ} .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`;
    
    process.stdout.write(`${stateName}... `);
    
    try {
      const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: sparql, format: 'json' })}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }, signal: AbortSignal.timeout(25000) });
      
      if (!res.ok) { console.log(`FAIL ${res.status}`); await sleep(2000); continue; }
      
      const data = await res.json();
      let inserted = 0;
      
      for (const b of data.results.bindings) {
        const name = b.itemLabel?.value;
        const coordStr = b.coord?.value;
        if (!name || !coordStr || /^Q\d+$/.test(name)) continue;
        
        const coord = parseCoord(coordStr);
        if (!coord) continue;
        
        const wikidataId = b.item?.value?.split('/').pop();
        if (globalSeen.has(wikidataId) || existingIds.has('wd-' + wikidataId)) continue;
        globalSeen.add(wikidataId);
        
        const desc = b.desc?.value || '';
        const imageUrl = b.image?.value ? b.image.value.replace(/\/\d+px-/, '/500px-') : '';
        const wikiUrl = b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
        
        try {
          await sql`INSERT INTO hg_sites (
            external_id, name, lat, lng, category, era, short_description,
            wiki_url, image_url, country, significance, source_id, source_ref, geog
          ) VALUES (
            ${'wd-' + wikidataId}, ${name}, ${coord.lat}, ${coord.lng},
            ${guessCategory(name, desc)}, ${'National Historic Landmark'}, ${desc || 'National Historic Landmark in ' + stateName},
            ${wikiUrl}, ${imageUrl}, ${'United States'}, ${4}, ${sourceId},
            ${'https://www.wikidata.org/wiki/' + wikidataId},
            ${`SRID=4326;POINT(${coord.lng} ${coord.lat})`}
          )`;
          inserted++;
          totalInserted++;
        } catch { totalSkipped++; }
      }
      
      console.log(`+${inserted}`);
    } catch (e) {
      console.log(`TIMEOUT`);
    }
    
    await sleep(2000);
  }
  
  console.log(`\n✅ Total inserted: ${totalInserted} (${totalSkipped} skipped)`);
  
  const usTotal = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'United States'`;
  const usImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'United States' AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`USA: ${usTotal[0].total} sites, ${usImg[0].total} with images`);
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total: ${grand[0].total}`);
}

run().catch(e => console.error(e));
