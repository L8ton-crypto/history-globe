const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Q142 = France
const queries = [
  {
    name: 'French Châteaux',
    category: 'medieval',
    era: 'Medieval / Renaissance',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q23413 wd:Q751876 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 1500`
  },
  {
    name: 'French Cathedrals',
    category: 'religious',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q2977 .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'French Abbeys & Monasteries',
    category: 'religious',
    era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q160742 wd:Q44613 wd:Q1128397 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'French Churches (notable)',
    category: 'religious',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16970 wd:Q317557 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 800`
  },
  {
    name: 'Roman Sites in France',
    category: 'roman',
    era: 'Roman',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q839954 wd:Q1081138 wd:Q24354 wd:Q34442 wd:Q41176 wd:Q12277 wd:Q373724 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      ?item wdt:P361*/wdt:P2348? ?period .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'French Aqueducts & Roman Bridges',
    category: 'roman',
    era: 'Roman',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q474 wd:Q12280 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 200`
  },
  {
    name: 'Megalithic Sites (dolmens, menhirs, cairns)',
    category: 'prehistoric',
    era: 'Neolithic',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q1311670 wd:Q152810 wd:Q839954 wd:Q35120 wd:Q179700 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'French Fortifications & City Walls',
    category: 'military',
    era: 'Medieval / Early Modern',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q57821 wd:Q3469910 wd:Q15127012 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'French Palaces & Stately Homes',
    category: 'heritage',
    era: 'Renaissance / Baroque',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16560 wd:Q1802963 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 300`
  },
  {
    name: 'French Lighthouses',
    category: 'maritime',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q39715 .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'French Battlefields & War Memorials',
    category: 'military',
    era: 'Various',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q4895508 wd:Q575759 wd:Q12876 }
      ?item wdt:P31 ?type .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 500`
  },
  {
    name: 'UNESCO Sites in France',
    category: 'heritage',
    era: 'World Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q9259 .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 200`
  },
  {
    name: 'Monuments historiques (notable)',
    category: 'heritage',
    era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q916333 .
      ?item wdt:P17 wd:Q142 .
      ?item wdt:P625 ?coord .
      ?item wdt:P18 ?image .
      ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr" }
    } LIMIT 1000`
  }
];

// Map to valid DB categories: roman, medieval, ancient, natural, cultural, industrial, religious
const categoryMap = {
  'medieval': 'medieval',
  'religious': 'religious',
  'roman': 'roman',
  'prehistoric': 'ancient',
  'military': 'cultural',
  'heritage': 'cultural',
  'maritime': 'industrial',
  'archaeological': 'ancient',
};

function mapCategory(cat) {
  return categoryMap[cat] || 'cultural';
}

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
      console.error(`  Query failed: ${res.status} ${res.statusText}`);
      if (res.status === 429) {
        console.error('  Rate limited - waiting 30s...');
        await sleep(30000);
      }
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
      
      // Skip items that only have a Q-number as label (no proper name)
      if (/^Q\d+$/.test(name)) continue;
      
      const imageUrl = binding.image?.value || '';
      const wikiArticle = binding.article?.value || '';
      const desc = binding.desc?.value || '';
      
      results.push({
        wikidataId, name, lat: coord.lat, lng: coord.lng,
        category: q.category, era: q.era,
        imageUrl: imageUrl ? imageUrl.replace(/\/\d+px-/, '/500px-') : '',
        wikiUrl: wikiArticle || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        description: desc, country: 'France'
      });
    }
    
    return results;
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    return [];
  }
}

async function run() {
  console.log('=== France Import ===\n');
  
  // Check existing French sites
  const existing = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country = 'France'`;
  const existingNames = new Set(existing.map(r => r.name));
  console.log(`Existing France sites: ${existingNames.size}\n`);
  
  // Get or create source
  let sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'wikidata-france'`;
  if (sourceRows.length === 0) {
    sourceRows = await sql`INSERT INTO hg_sources (name, display_name, url) VALUES ('wikidata-france', 'Wikidata (France)', 'https://www.wikidata.org') RETURNING id`;
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
    await sleep(5000); // 5s between queries to be nice to Wikidata
  }
  
  // Dedup against existing DB entries
  const toInsert = allSites.filter(s => !existingNames.has(s.name.toLowerCase()));
  console.log(`\nTotal unique from Wikidata: ${allSites.length}`);
  console.log(`To insert (after dedup): ${toInsert.length}\n`);
  
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < toInsert.length; i++) {
    const s = toInsert[i];
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + s.wikidataId}, ${s.name}, ${s.lat}, ${s.lng},
        ${mapCategory(s.category)}, ${s.era},
        ${s.description || 'Historical site in France'},
        ${s.wikiUrl}, ${s.imageUrl}, ${'France'}, ${3}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      if (!e.message?.includes('duplicate')) {
        errors++;
        if (errors <= 5) console.error(`  Error: ${s.name}: ${e.message?.substring(0, 80)}`);
      }
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${toInsert.length} (${inserted} inserted)`);
  }
  
  console.log(`\n✅ Inserted ${inserted} French sites (${errors} errors)`);
  
  // Stats
  const franceTotal = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'France'`;
  const franceImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'France' AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`France total: ${franceTotal[0].total} sites (${franceImg[0].total} with images)`);
  
  const grandTotal = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total all sites: ${grandTotal[0].total}`);
}

run().catch(e => console.error(e));
