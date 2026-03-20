const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

// Map unsupported categories to valid ones
const categoryMap = {
  'prehistoric': 'ancient',
  'heritage': 'cultural',
  'archaeological': 'ancient'
};

async function run() {
  // Re-run the failed inserts with corrected categories
  // First, get all existing external_ids to know what's already in
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Already imported: ${existingIds.size} wikidata sites`);
  
  // Re-fetch the data from wikidata for the missing categories
  const queries = [
    {
      name: 'Irish Dolmens & Passage Tombs',
      category: 'ancient',
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
      name: 'Irish National Monuments',
      category: 'cultural',
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
      name: 'Irish Stone Forts & Ringforts',
      category: 'ancient',
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
      name: 'NI Castles (heritage)',
      category: 'medieval',
      era: 'Heritage',
      sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
        ?item wdt:P31 wd:Q23413 .
        ?item wdt:P17 wd:Q145 .
        ?item wdt:P625 ?coord .
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

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'wikidata-ireland'`;
  const sourceId = sourceRows[0].id;
  
  let totalInserted = 0;

  for (const q of queries) {
    console.log(`\nQuerying: ${q.name}...`);
    const url = 'https://query.wikidata.org/sparql';
    const params = new URLSearchParams({ query: q.sparql, format: 'json' });
    
    try {
      const res = await fetch(`${url}?${params}`, {
        headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
      });
      
      if (!res.ok) {
        console.log(`  Failed: ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      const seen = new Set();
      let inserted = 0;
      
      for (const binding of data.results.bindings) {
        const name = binding.itemLabel?.value;
        const coordStr = binding.coord?.value;
        if (!name || !coordStr || /^Q\d+$/.test(name)) continue;
        
        const coord = parseCoord(coordStr);
        if (!coord) continue;
        
        const wikidataId = binding.item?.value?.split('/').pop();
        if (seen.has(wikidataId)) continue;
        seen.add(wikidataId);
        
        const extId = 'wd-' + wikidataId;
        if (existingIds.has(extId)) continue;
        
        const imageUrl = binding.image?.value ? binding.image.value.replace(/\/\d+px-/, '/500px-') : '';
        const wikiArticle = binding.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
        const desc = binding.desc?.value || `Historical site in Ireland`;
        const country = (coord.lat > 54.0 && coord.lng > -8.2 && coord.lng < -5.4) ? 'Northern Ireland' : 'Ireland';
        
        try {
          await sql`INSERT INTO hg_sites (
            external_id, name, lat, lng, category, era, short_description,
            wiki_url, image_url, country, significance, source_id, source_ref, geog
          ) VALUES (
            ${extId}, ${name}, ${coord.lat}, ${coord.lng},
            ${q.category}, ${q.era}, ${desc},
            ${wikiArticle}, ${imageUrl}, ${country}, ${3}, ${sourceId},
            ${'https://www.wikidata.org/wiki/' + wikidataId},
            ${`SRID=4326;POINT(${coord.lng} ${coord.lat})`}
          )`;
          inserted++;
          existingIds.add(extId);
        } catch (e) {
          // skip
        }
      }
      
      console.log(`  Inserted: ${inserted}`);
      totalInserted += inserted;
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    
    await sleep(3000);
  }
  
  console.log(`\n✅ Total new inserts: ${totalInserted}`);
  
  const total = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland')`;
  const withImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland') AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`Ireland/NI: ${total[0].total} sites (${withImg[0].total} with images)`);
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total: ${grand[0].total}`);
}

run().catch(e => console.error(e));
