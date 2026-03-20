const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function testQuery(name, sparql) {
  console.log(`\nTesting: ${name}`);
  const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: sparql, format: 'json' })}`;
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' },
      signal: AbortSignal.timeout(30000)
    });
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  Results: ${data.results?.bindings?.length || 0}`);
      if (data.results?.bindings?.length > 0) {
        const first = data.results.bindings[0];
        console.log(`  First: ${first.itemLabel?.value} @ ${first.coord?.value?.substring(0, 30)}`);
      }
    }
  } catch (e) {
    console.log(`  Error: ${e.message?.substring(0, 60)}`);
  }
  await sleep(3000);
}

async function run() {
  // Test 1: Simple NHL query - does P1435/Q15243209 work at all?
  await testQuery('NHL count', `SELECT (COUNT(?item) AS ?count) WHERE { ?item wdt:P1435 wd:Q15243209 . }`);
  
  // Test 2: NHL with coords - small limit
  await testQuery('NHL with coords (limit 5)', `SELECT ?item ?itemLabel ?coord WHERE {
    ?item wdt:P1435 wd:Q15243209 .
    ?item wdt:P625 ?coord .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  } LIMIT 5`);
  
  // Test 3: Try direct P17 (country) instead of geographic filter
  await testQuery('NHL in USA via P17 (limit 10)', `SELECT ?item ?itemLabel ?coord WHERE {
    ?item wdt:P1435 wd:Q15243209 .
    ?item wdt:P17 wd:Q30 .
    ?item wdt:P625 ?coord .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  } LIMIT 10`);
  
  // Test 4: Just landmarks with images in USA
  await testQuery('NHL in USA with images (limit 10)', `SELECT ?item ?itemLabel ?coord ?image WHERE {
    ?item wdt:P1435 wd:Q15243209 .
    ?item wdt:P17 wd:Q30 .
    ?item wdt:P625 ?coord .
    ?item wdt:P18 ?image .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  } LIMIT 10`);
  
  // Test 5: Canadian NHS
  await testQuery('Canadian NHS (limit 10)', `SELECT ?item ?itemLabel ?coord WHERE {
    ?item wdt:P1435 wd:Q1568856 .
    ?item wdt:P625 ?coord .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  } LIMIT 10`);
}

run();
