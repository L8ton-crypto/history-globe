const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const searches = [
  { query: "Holy Trinity Church, Stratford-upon-Avon", category: "religious" },
  { query: "New Place Shakespeare", category: "medieval" },
  { query: "Guild Chapel Stratford-upon-Avon", category: "religious" },
  { query: "Harvard House Stratford-upon-Avon", category: "medieval" },
  { query: "Clopton Bridge", category: "medieval" },
  { query: "King Edward VI School Stratford-upon-Avon", category: "cultural" },
  { query: "Shakespeare Memorial Theatre", category: "cultural" },
  { query: "Warwick Castle", category: "medieval" },
  { query: "Kenilworth Castle", category: "medieval" },
];

async function searchWikidata(query) {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=3&format=json`;
  const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
  const searchData = await searchRes.json();
  if (!searchData.search?.length) return null;
  
  for (const result of searchData.search) {
    const qid = result.id;
    const sparql = `SELECT ?coord ?image ?article ?desc WHERE {
      wd:${qid} wdt:P625 ?coord .
      OPTIONAL { wd:${qid} wdt:P18 ?image }
      OPTIONAL { ?article schema:about wd:${qid} ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { wd:${qid} schema:description ?desc . FILTER(LANG(?desc) = "en") }
    } LIMIT 1`;
    
    const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: sparql, format: 'json' })}`, 
      { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
    if (!res.ok) continue;
    const data = await res.json();
    
    if (data.results?.bindings?.length) {
      const b = data.results.bindings[0];
      const coordMatch = b.coord?.value?.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!coordMatch) continue;
      
      return {
        wikidataId: qid, name: result.label,
        description: result.description || b.desc?.value || '',
        lat: parseFloat(coordMatch[2]), lng: parseFloat(coordMatch[1]),
        imageUrl: b.image?.value ? b.image.value.replace(/\/\d+px-/, '/500px-') : '',
        wikiUrl: b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(result.label.replace(/ /g, '_'))}`,
      };
    }
    await sleep(1000);
  }
  return null;
}

async function run() {
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  let inserted = 0;
  
  for (const { query, category } of searches) {
    console.log(`Searching: ${query}...`);
    const site = await searchWikidata(query);
    if (!site) { console.log('  Not found'); await sleep(2000); continue; }
    
    const existing = await sql`SELECT id FROM hg_sites WHERE external_id = ${'wd-' + site.wikidataId}`;
    if (existing.length > 0) { console.log(`  Already exists: ${site.name}`); await sleep(2000); continue; }
    
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + site.wikidataId}, ${site.name}, ${site.lat}, ${site.lng},
        ${category}, ${'Medieval / Tudor'}, ${site.description},
        ${site.wikiUrl}, ${site.imageUrl}, ${'England'}, ${4}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + site.wikidataId},
        ${`SRID=4326;POINT(${site.lng} ${site.lat})`}
      )`;
      console.log(`  ✅ ${site.name} (${site.lat}, ${site.lng})`);
      inserted++;
    } catch (e) {
      console.log(`  ❌ ${e.message?.substring(0, 80)}`);
    }
    await sleep(2000);
  }
  
  console.log(`\n✅ Inserted ${inserted} more sites`);
}
run().catch(e => console.error(e));
