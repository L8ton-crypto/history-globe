const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const categoryMap = { 'medieval':'medieval','religious':'religious','roman':'roman','ancient':'ancient','cultural':'cultural','industrial':'industrial' };
function mapCat(c) { return categoryMap[c] || 'cultural'; }

function parseCoord(s) {
  const m = s.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  return m ? { lng: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

const jobs = [
  // Croatia
  { country: 'Croatia', qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q23413 wd:Q57821 } ?item wdt:P31 ?type . ?item wdt:P17 wd:Q224 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hr" }
    } LIMIT 200` },
  { country: 'Croatia', qname: 'Churches', category: 'religious', era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 wd:Q224 .
      ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hr" }
    } LIMIT 200` },
  { country: 'Croatia', qname: 'UNESCO', category: 'cultural', era: 'World Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q9259 . ?item wdt:P17 wd:Q224 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hr" }
    } LIMIT 100` },
  // Turkey
  { country: 'Turkey', qname: 'Ancient Sites', category: 'ancient', era: 'Ancient',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q839954 wd:Q24354 wd:Q41176 wd:Q44539 } ?item wdt:P31 ?type . ?item wdt:P17 wd:Q43 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr" }
    } LIMIT 800` },
  { country: 'Turkey', qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval / Ottoman',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q23413 wd:Q57821 } ?item wdt:P31 ?type . ?item wdt:P17 wd:Q43 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr" }
    } LIMIT 500` },
  { country: 'Turkey', qname: 'Mosques & Churches', category: 'religious', era: 'Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      VALUES ?type { wd:Q32815 wd:Q16970 wd:Q2977 } ?item wdt:P31 ?type . ?item wdt:P17 wd:Q43 .
      ?item wdt:P625 ?coord . ?item wdt:P18 ?image .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr" }
    } LIMIT 500` },
  { country: 'Turkey', qname: 'UNESCO', category: 'cultural', era: 'World Heritage',
    sparql: `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
      ?item wdt:P1435 wd:Q9259 . ?item wdt:P17 wd:Q43 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr" }
    } LIMIT 200` },
];

async function run() {
  console.log('=== Croatia + Turkey Import ===\n');

  const allByCountry = {};

  for (const job of jobs) {
    console.log(`Querying: ${job.country} - ${job.qname}...`);
    const url = 'https://query.wikidata.org/sparql';
    const params = new URLSearchParams({ query: job.sparql, format: 'json' });
    
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${url}?${params}`, {
          headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
        });
        if (res.status === 429) { console.log('  Rate limited, waiting 60s...'); await sleep(60000); continue; }
        if (!res.ok) { console.log(`  Failed: ${res.status}`); await sleep(10000); continue; }
        data = await res.json();
        break;
      } catch (e) { console.log(`  Error: ${e.message}`); await sleep(10000); }
    }
    if (!data?.results) { console.log('  (no results)'); await sleep(5000); continue; }

    if (!allByCountry[job.country]) allByCountry[job.country] = { sites: [], seen: new Set() };
    const c = allByCountry[job.country];

    for (const b of data.results.bindings) {
      const name = b.itemLabel?.value;
      const coordStr = b.coord?.value;
      if (!name || !coordStr) continue;
      const coord = parseCoord(coordStr);
      if (!coord) continue;
      const wdId = b.item?.value?.split('/').pop();
      if (c.seen.has(wdId) || /^Q\d+$/.test(name)) continue;
      c.seen.add(wdId);
      const imgUrl = b.image?.value || '';
      c.sites.push({
        wikidataId: wdId, name, lat: coord.lat, lng: coord.lng,
        category: job.category, era: job.era,
        imageUrl: imgUrl ? imgUrl.replace(/\/\d+px-/, '/500px-') : '',
        wikiUrl: b.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        description: b.desc?.value || '', country: job.country
      });
    }
    console.log(`  → ${data.results.bindings.length} raw, ${c.sites.length} total unique for ${job.country}`);
    await sleep(5000);
  }

  // Insert per country
  for (const [country, c] of Object.entries(allByCountry)) {
    console.log(`\n🌍 ${country.toUpperCase()}`);
    const existing = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country = ${country}`;
    const existingNames = new Set(existing.map(r => r.name));
    console.log(`  Existing: ${existingNames.size}`);

    const srcName = `wikidata-${country.toLowerCase()}`;
    let srcRows = await sql`SELECT id FROM hg_sources WHERE name = ${srcName}`;
    if (srcRows.length === 0) {
      srcRows = await sql`INSERT INTO hg_sources (name, display_name, url) VALUES (${srcName}, ${'Wikidata (' + country + ')'}, 'https://www.wikidata.org') RETURNING id`;
    }
    const sourceId = srcRows[0].id;

    const toInsert = c.sites.filter(s => !existingNames.has(s.name.toLowerCase()));
    console.log(`  Unique: ${c.sites.length} | New: ${toInsert.length}`);

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i++) {
      const s = toInsert[i];
      try {
        await sql`INSERT INTO hg_sites (
          external_id, name, lat, lng, category, era, short_description,
          wiki_url, image_url, country, significance, source_id, source_ref, geog
        ) VALUES (
          ${'wd-' + s.wikidataId}, ${s.name}, ${s.lat}, ${s.lng},
          ${mapCat(s.category)}, ${s.era},
          ${(s.description || 'Historical site in ' + s.country).substring(0, 490)},
          ${s.wikiUrl}, ${s.imageUrl}, ${s.country}, ${3}, ${sourceId},
          ${'https://www.wikidata.org/wiki/' + s.wikidataId},
          ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
        )`;
        inserted++;
      } catch (e) {
        if (!e.message?.includes('duplicate')) console.error(`  Err: ${s.name}: ${e.message?.substring(0, 60)}`);
      }
      if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${toInsert.length} (${inserted} inserted)`);
    }
    console.log(`  ✅ Inserted: ${inserted}`);

    const total = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${country}`;
    const img = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${country} AND image_url IS NOT NULL AND image_url != ''`;
    console.log(`  Total: ${total[0].total} (${img[0].total} with images)`);
  }

  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const grandImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\n🏛️ GRAND TOTAL: ${grand[0].total} sites (${grandImg[0].total} with images)`);
}

run().catch(e => console.error('FATAL:', e));
