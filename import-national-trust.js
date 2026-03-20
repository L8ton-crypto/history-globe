const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const queries = [
  {
    name: 'National Trust properties',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P137 wd:Q333515 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 1000`
  },
  {
    name: 'National Trust owned heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P127 wd:Q333515 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 1000`
  },
  {
    name: 'National Trust for Scotland',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      { ?item wdt:P137 wd:Q2638824 } UNION { ?item wdt:P127 wd:Q2638824 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  }
];

function parseCoord(coordStr) {
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

function guessCategory(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|tower|manor|hall|palace|gatehouse|battlement/i.test(text)) return 'medieval';
  if (/church|abbey|priory|chapel|cathedral|monastery|friary/i.test(text)) return 'religious';
  if (/roman|villa|bath|amphitheatre/i.test(text)) return 'roman';
  if (/mill|mine|quarry|canal|bridge|railway|industrial|kiln|forge/i.test(text)) return 'industrial';
  if (/stone circle|barrow|dolmen|cairn|hillfort|bronze|iron age|neolithic|megalith/i.test(text)) return 'ancient';
  if (/garden|park|landscape|coast|cliff|nature|woodland|beach/i.test(text)) return 'natural';
  return 'cultural';
}

function guessCountry(lat, lng) {
  // Rough geographic boundaries
  if (lat > 54.7 && lng < -4.5) return 'Scotland';
  if (lat > 51.3 && lat < 53.5 && lng < -2.6) return 'Wales';
  if (lat > 54.0 && lng > -8.2 && lng < -5.4) return 'Northern Ireland';
  return 'England';
}

async function run() {
  console.log('=== National Trust Import ===\n');
  
  // Get existing external_ids to deduplicate
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  
  // Also check by proximity to avoid geographic dupes
  const allSites = await sql`SELECT name, lat, lng FROM hg_sites`;
  const coordKeys = new Set(allSites.map(s => `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`));
  
  console.log(`Existing wikidata sites: ${existingIds.size}`);
  console.log(`Total sites for coord dedup: ${allSites.length}\n`);
  
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'national_trust'`;
  const sourceId = sourceRows[0].id;
  
  let allResults = [];
  const globalSeen = new Set();
  
  for (const q of queries) {
    console.log(`Querying: ${q.name}...`);
    const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: q.sparql, format: 'json' })}`;
    
    try {
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
        
        const extId = 'wd-' + wikidataId;
        if (existingIds.has(extId)) continue;
        
        // Skip if very close to existing site
        const coordKey = `${coord.lat.toFixed(3)},${coord.lng.toFixed(3)}`;
        
        const desc = b.desc?.value || '';
        const imageUrl = b.image?.value ? b.image.value.replace(/\/\d+px-/, '/500px-') : '';
        const wikiUrl = b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
        
        allResults.push({
          extId, wikidataId, name, lat: coord.lat, lng: coord.lng,
          category: guessCategory(name, desc),
          description: desc || `National Trust property`,
          imageUrl, wikiUrl,
          country: guessCountry(coord.lat, coord.lng)
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
        ${s.category}, ${'Heritage'},
        ${s.description},
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
  
  console.log(`\n✅ Inserted ${inserted} National Trust sites (${skipped} skipped)`);
  
  // Update source count
  await sql`UPDATE hg_sources SET site_count = ${inserted}, last_imported_at = NOW() WHERE id = ${sourceId}`;
  
  // Final stats
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const withImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\nGrand total: ${grand[0].total} sites (${withImg[0].total} with images, ${((withImg[0].total/grand[0].total)*100).toFixed(1)}%)`);
  
  // Country breakdown for new additions
  const byCountry = {};
  allResults.forEach(s => { byCountry[s.country] = (byCountry[s.country] || 0) + 1; });
  console.log('\nNT sites by country:');
  Object.entries(byCountry).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

run().catch(e => console.error(e));
