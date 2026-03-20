const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const queries = [
  {
    name: 'Irish Castles',
    category: 'medieval',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q23413 .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'Irish Tower Houses',
    category: 'medieval',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q1331783 .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'Irish Abbeys',
    category: 'religious',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q160742 .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Irish Monasteries',
    category: 'religious',
    era: 'Early Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q44613 .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Irish Round Towers',
    category: 'religious',
    era: 'Early Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q1072567 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  },
  {
    name: 'Irish Dolmens & Passage Tombs',
    category: 'prehistoric',
    era: 'Neolithic',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q839954 wd:Q1517701 wd:Q1311670 }
      ?item wdt:P31 ?type .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Irish Stone Forts & Ringforts',
    category: 'prehistoric',
    era: 'Iron Age',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q1584116 wd:Q1307037 wd:Q1555891 }
      ?item wdt:P31 ?type .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Irish Churches & Cathedrals',
    category: 'religious',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q16970 .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Irish National Monuments',
    category: 'heritage',
    era: 'National Monument',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q1757129 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'Irish Archaeological Sites',
    category: 'archaeological',
    era: 'Various',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q839954 .
      { ?item wdt:P17 wd:Q22 } UNION { ?item wdt:P17 wd:Q27 }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'NI Listed Buildings (Grade A)',
    category: 'heritage',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q23413 .
      ?item wdt:P17 wd:Q145 .
      ?item wdt:P625 ?coord .
      FILTER EXISTS {
        ?item wdt:P131 ?loc .
        ?loc wdt:P17 wd:Q145 .
      }
      FILTER(
        geof:latitude(?coord) > 54.0 && geof:latitude(?coord) < 55.5 &&
        geof:longitude(?coord) > -8.5 && geof:longitude(?coord) < -5.4
      )
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

async function runQuery(q) {
  const url = 'https://query.wikidata.org/sparql';
  const params = new URLSearchParams({ query: q.sparql, format: 'json' });
  
  try {
    const res = await fetch(`${url}?${params}`, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
    });
    
    if (!res.ok) {
      console.error(`  Query failed: ${res.status}`);
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
      
      if (/^Q\d+$/.test(name)) continue;
      
      const imageUrl = binding.image?.value || '';
      const wikiArticle = binding.article?.value || '';
      const desc = binding.desc?.value || '';
      
      const country = (coord.lat > 54.0 && coord.lng > -8.2 && coord.lng < -5.4) ? 'Northern Ireland' : 'Ireland';
      
      results.push({
        wikidataId, name, lat: coord.lat, lng: coord.lng,
        category: q.category, era: q.era,
        imageUrl: imageUrl ? imageUrl.replace(/\/\d+px-/, '/500px-') : '',
        wikiUrl: wikiArticle || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        description: desc, country
      });
    }
    
    return results;
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    return [];
  }
}

async function run() {
  console.log('=== Ireland Import v2 (simplified SPARQL) ===\n');
  
  const existing = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland') OR (lat BETWEEN 51.4 AND 55.4 AND lng BETWEEN -10.5 AND -5.5)`;
  const existingNames = new Set(existing.map(r => r.name));
  console.log(`Existing Ireland sites: ${existingNames.size}\n`);
  
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
    
    const newSites = sites.filter(s => {
      const key = s.wikidataId;
      if (globalSeen.has(key)) return false;
      globalSeen.add(key);
      return true;
    });
    
    console.log(`  Found: ${sites.length} (${newSites.length} unique new)`);
    allSites.push(...newSites);
    await sleep(3000);
  }
  
  const toInsert = allSites.filter(s => !existingNames.has(s.name.toLowerCase()));
  console.log(`\nTotal unique: ${allSites.length}`);
  console.log(`To insert (after dedup): ${toInsert.length}\n`);
  
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i++) {
    const s = toInsert[i];
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + s.wikidataId}, ${s.name}, ${s.lat}, ${s.lng},
        ${s.category}, ${s.era},
        ${s.description || 'Historical site in ' + s.country},
        ${s.wikiUrl}, ${s.imageUrl}, ${s.country}, ${3}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      if (!e.message?.includes('duplicate')) {
        console.error(`  Error: ${s.name}: ${e.message?.substring(0, 80)}`);
      }
    }
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${toInsert.length} (${inserted} inserted)`);
  }
  
  console.log(`\n✅ Inserted ${inserted} sites`);
  
  const total = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland')`;
  const withImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland') AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`Ireland/NI total: ${total[0].total} sites (${withImg[0].total} with images)`);
  
  const grandTotal = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total all sites: ${grandTotal[0].total}`);
}

run().catch(e => console.error(e));
