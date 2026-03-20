const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Instead of heritage designation, query by type + country
const queries = [
  {
    name: 'US Castles',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q23413 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'US Historic Houses & Museums',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q1081138 wd:Q1128944 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'US Forts',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q57821 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'US Lighthouses',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q39715 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'US Cathedrals & Historic Churches',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16970 wd:Q317557 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 500`
  },
  {
    name: 'US Battlefields',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q178561 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'US Missions (Spanish)',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q1127903 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  },
  {
    name: 'US State Capitols',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q180654 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 100`
  },
  {
    name: 'US National Memorials',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q1440476 . ?item wdt:P17 wd:Q30 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  },
  {
    name: 'Canadian Forts',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q57821 . ?item wdt:P17 wd:Q16 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  },
  {
    name: 'Canadian Lighthouses',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q39715 . ?item wdt:P17 wd:Q16 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Canadian Cathedrals & Churches',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q16970 wd:Q317557 }
      ?item wdt:P31 ?type . ?item wdt:P17 wd:Q16 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 300`
  },
  {
    name: 'Canadian Castles',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P31 wd:Q23413 . ?item wdt:P17 wd:Q16 . ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image } OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    } LIMIT 200`
  }
];

function parseCoord(s) { const m = s.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/); return m ? { lng: +m[1], lat: +m[2] } : null; }

function guessCategory(name, desc) {
  const t = `${name} ${desc}`.toLowerCase();
  if (/castle|fort|fortress|barracks|citadel|stockade/i.test(t)) return 'medieval';
  if (/church|cathedral|chapel|abbey|monastery|mission|basilica|synagogue|mosque|temple/i.test(t)) return 'religious';
  if (/battle|military|war|memorial|cemetery/i.test(t)) return 'cultural';
  if (/archaeological|pueblo|mound|petroglyph|cliff|native|prehistoric|ancient|ruins|cairn/i.test(t)) return 'ancient';
  if (/mill|mine|bridge|canal|railway|lighthouse|dam|factory|industrial/i.test(t)) return 'industrial';
  if (/park|canyon|volcano|cave|reef|forest|desert|glacier|mountain|crater|falls/i.test(t)) return 'natural';
  return 'cultural';
}

async function run() {
  console.log('=== North America Direct Import ===\n');
  
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'wd-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  const globalSeen = new Set();
  let totalInserted = 0;
  
  for (const q of queries) {
    process.stdout.write(`${q.name}... `);
    try {
      const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: q.sparql, format: 'json' })}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'HistoryGlobe/1.0' }, signal: AbortSignal.timeout(30000) });
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
        const country = coord.lat > 49 ? 'Canada' : 'United States';
        
        try {
          await sql`INSERT INTO hg_sites (
            external_id, name, lat, lng, category, era, short_description,
            wiki_url, image_url, country, significance, source_id, source_ref, geog
          ) VALUES (
            ${'wd-' + wikidataId}, ${name}, ${coord.lat}, ${coord.lng},
            ${guessCategory(name, desc)}, ${'Heritage'}, ${desc || 'Historic site'},
            ${wikiUrl}, ${imageUrl}, ${country}, ${3}, ${sourceId},
            ${'https://www.wikidata.org/wiki/' + wikidataId},
            ${`SRID=4326;POINT(${coord.lng} ${coord.lat})`}
          )`;
          inserted++;
          totalInserted++;
        } catch {}
      }
      console.log(`+${inserted}`);
    } catch (e) {
      console.log(`ERR: ${e.message?.substring(0, 40)}`);
    }
    await sleep(3000);
  }
  
  console.log(`\n✅ Total inserted: ${totalInserted}`);
  for (const c of ['United States', 'Canada']) {
    const t = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c}`;
    const img = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c} AND image_url IS NOT NULL AND image_url != ''`;
    console.log(`${c}: ${t[0].total} sites (${img[0].total} with images)`);
  }
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total: ${grand[0].total}`);
}
run().catch(e => console.error(e));
