const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Key Shakespeare / Stratford landmarks to search Wikidata for
const searches = [
  "Shakespeare's Birthplace",
  "Anne Hathaway's Cottage",
  "Holy Trinity Church Stratford-upon-Avon",
  "Hall's Croft",
  "New Place Stratford",
  "Mary Arden's Farm",
  "Nash's House",
  "Royal Shakespeare Theatre",
  "Shakespeare's Globe",
  "Harvard House Stratford",
  "Guild Chapel Stratford",
  "King Edward VI School Stratford",
  "Stratford-upon-Avon Canal",
  "Clopton Bridge Stratford",
];

async function searchWikidata(query) {
  // Search for the item
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=3&format=json`;
  const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
  const searchData = await searchRes.json();
  
  if (!searchData.search?.length) return null;
  
  // Try each result to find one with coordinates
  for (const result of searchData.search) {
    const qid = result.id;
    const sparql = `SELECT ?coord ?image ?article ?desc WHERE {
      wd:${qid} wdt:P625 ?coord .
      OPTIONAL { wd:${qid} wdt:P18 ?image }
      OPTIONAL { ?article schema:about wd:${qid} ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { wd:${qid} schema:description ?desc . FILTER(LANG(?desc) = "en") }
    } LIMIT 1`;
    
    const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: sparql, format: 'json' })}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
    
    if (!res.ok) continue;
    const data = await res.json();
    
    if (data.results?.bindings?.length) {
      const b = data.results.bindings[0];
      const coordMatch = b.coord?.value?.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!coordMatch) continue;
      
      return {
        wikidataId: qid,
        name: result.label,
        description: result.description || b.desc?.value || '',
        lat: parseFloat(coordMatch[2]),
        lng: parseFloat(coordMatch[1]),
        imageUrl: b.image?.value ? b.image.value.replace(/\/\d+px-/, '/500px-') : '',
        wikiUrl: b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(result.label.replace(/ /g, '_'))}`,
      };
    }
    await sleep(1000);
  }
  return null;
}

async function run() {
  console.log('=== Stratford / Shakespeare Import ===\n');
  
  // Get source id for manual
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  
  let inserted = 0;
  
  for (const query of searches) {
    console.log(`Searching: ${query}...`);
    const site = await searchWikidata(query);
    
    if (!site) {
      console.log('  Not found');
      await sleep(2000);
      continue;
    }
    
    // Check not already in DB
    const existing = await sql`SELECT id FROM hg_sites WHERE external_id = ${'wd-' + site.wikidataId}`;
    if (existing.length > 0) {
      console.log(`  Already exists: ${site.name}`);
      await sleep(2000);
      continue;
    }
    
    // Determine category
    let category = 'cultural';
    if (/church|chapel|trinity/i.test(site.name)) category = 'religious';
    else if (/theatre|globe/i.test(site.name)) category = 'cultural';
    else if (/bridge|canal/i.test(site.name)) category = 'industrial';
    else if (/castle|house|cottage|croft|farm/i.test(site.name)) category = 'medieval';
    
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + site.wikidataId}, ${site.name}, ${site.lat}, ${site.lng},
        ${category}, ${'Tudor / Renaissance'},
        ${site.description || 'Shakespeare-related landmark in Stratford-upon-Avon'},
        ${site.wikiUrl}, ${site.imageUrl}, ${'England'}, ${4}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + site.wikidataId},
        ${`SRID=4326;POINT(${site.lng} ${site.lat})`}
      )`;
      console.log(`  ✅ ${site.name} (${site.lat}, ${site.lng}) [${category}]`);
      inserted++;
    } catch (e) {
      console.log(`  ❌ Error: ${e.message?.substring(0, 80)}`);
    }
    
    await sleep(2000);
  }
  
  console.log(`\n✅ Inserted ${inserted} Shakespeare/Stratford sites`);
  
  // Show what we have now
  const nearby = await sql`SELECT name, category, image_url FROM hg_sites 
    WHERE lat BETWEEN 52.15 AND 52.23 AND lng BETWEEN -1.75 AND -1.65 ORDER BY name`;
  console.log(`\nStratford area now has ${nearby.length} sites:`);
  nearby.forEach(r => console.log(`  ${r.name} (${r.category}) ${r.image_url ? '📷' : '❌'}`));
}

run().catch(e => console.error(e));
