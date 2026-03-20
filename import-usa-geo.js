const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Split USA into geographic quadrants to keep queries small
const regions = [
  { name: 'USA Northeast', minLat: 38, maxLat: 48, minLng: -80, maxLng: -66 },
  { name: 'USA Southeast', minLat: 24, maxLat: 38, minLng: -90, maxLng: -75 },
  { name: 'USA Midwest North', minLat: 40, maxLat: 50, minLng: -105, maxLng: -80 },
  { name: 'USA Midwest South', minLat: 30, maxLat: 40, minLng: -105, maxLng: -80 },
  { name: 'USA West Coast', minLat: 32, maxLat: 50, minLng: -125, maxLng: -105 },
  { name: 'USA Southwest', minLat: 24, maxLat: 38, minLng: -125, maxLng: -90 },
  { name: 'USA Alaska', minLat: 50, maxLat: 72, minLng: -170, maxLng: -130 },
  { name: 'USA Hawaii', minLat: 18, maxLat: 23, minLng: -162, maxLng: -154 },
  { name: 'Canada East', minLat: 42, maxLat: 63, minLng: -80, maxLng: -50 },
  { name: 'Canada Central', minLat: 48, maxLat: 63, minLng: -110, maxLng: -80 },
  { name: 'Canada West', minLat: 48, maxLat: 63, minLng: -140, maxLng: -110 },
];

function parseCoord(coordStr) {
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

function guessCategory(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|fortress|barracks|citadel/i.test(text)) return 'medieval';
  if (/church|cathedral|chapel|abbey|monastery|mission|basilica|synagogue|mosque|temple/i.test(text)) return 'religious';
  if (/battle|military|war|army|navy|memorial|cemetery|veteran/i.test(text)) return 'cultural';
  if (/archaeological|pueblo|mound|petroglyph|cliff dwelling|native|indigenous|prehistoric|ancient|ruins|cairn/i.test(text)) return 'ancient';
  if (/mill|mine|bridge|canal|railway|lighthouse|dam|factory|industrial|wharf|dock/i.test(text)) return 'industrial';
  if (/park|canyon|volcano|cave|reef|forest|wilderness|desert|glacier|geyser|mountain|crater|falls/i.test(text)) return 'natural';
  return 'cultural';
}

function guessCountry(lat, lng) {
  if (lat > 49 && lng < -50) return 'Canada';
  if (lat > 42 && lng < -80 && lng > -95) return lat > 49 ? 'Canada' : 'United States';
  if (lat > 60) return lng < -140 ? 'United States' : 'Canada'; // Alaska vs Yukon
  return 'United States';
}

async function run() {
  console.log('=== North America Import (Geographic) ===\n');
  
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Existing wikidata sites: ${existingIds.size}\n`);
  
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  
  const globalSeen = new Set();
  let totalInserted = 0;
  
  for (const region of regions) {
    // Query for National Historic Landmarks and notable heritage in this bbox
    const sparql = `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 ?heritage .
      VALUES ?heritage { wd:Q15243209 wd:Q1568856 }
      ?item wdt:P625 ?coord .
      FILTER(
        geof:latitude(?coord) > ${region.minLat} && geof:latitude(?coord) < ${region.maxLat} &&
        geof:longitude(?coord) > ${region.minLng} && geof:longitude(?coord) < ${region.maxLng}
      )
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`;
    
    process.stdout.write(`${region.name}... `);
    
    try {
      const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: sparql, format: 'json' })}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }, signal: AbortSignal.timeout(30000) });
      
      if (!res.ok) { console.log(`FAIL ${res.status}`); await sleep(3000); continue; }
      
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
        const country = guessCountry(coord.lat, coord.lng);
        
        try {
          await sql`INSERT INTO hg_sites (
            external_id, name, lat, lng, category, era, short_description,
            wiki_url, image_url, country, significance, source_id, source_ref, geog
          ) VALUES (
            ${'wd-' + wikidataId}, ${name}, ${coord.lat}, ${coord.lng},
            ${guessCategory(name, desc)}, ${'National Historic Landmark'},
            ${desc || 'Historic landmark in ' + country},
            ${wikiUrl}, ${imageUrl}, ${country}, ${4}, ${sourceId},
            ${'https://www.wikidata.org/wiki/' + wikidataId},
            ${`SRID=4326;POINT(${coord.lng} ${coord.lat})`}
          )`;
          inserted++;
          totalInserted++;
        } catch { }
      }
      
      console.log(`+${inserted}`);
    } catch (e) {
      console.log(`TIMEOUT/ERR`);
    }
    
    await sleep(3000);
  }
  
  console.log(`\n✅ Total inserted: ${totalInserted}`);
  
  for (const c of ['United States', 'Canada']) {
    const t = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c}`;
    const img = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c} AND image_url IS NOT NULL AND image_url != ''`;
    console.log(`${c}: ${t[0].total} sites, ${img[0].total} with images (${((img[0].total/t[0].total)*100).toFixed(0)}%)`);
  }
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total: ${grand[0].total}`);
}

run().catch(e => console.error(e));
