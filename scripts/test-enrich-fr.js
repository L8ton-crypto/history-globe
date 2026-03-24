async function run() {
  // Try French Wikipedia and Wikidata French descriptions
  const tests = [
    { qid: 'Q2665983', name: 'Château du Mazeau' },
    { qid: 'Q2673929', name: 'Château de Bocaud' },
    { qid: 'Q2677480', name: 'Château Royal du Vivier' },
  ];

  for (const t of tests) {
    console.log(`\n--- ${t.name} ---`);
    
    // Try Wikidata with French
    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${t.qid}&props=descriptions|sitelinks&languages=en,fr&sitefilter=enwiki,frwiki&format=json`, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0' }
    });
    const data = await res.json();
    const entity = data.entities?.[t.qid];
    console.log(`  FR desc: ${entity?.descriptions?.fr?.value || 'NONE'}`);
    console.log(`  EN desc: ${entity?.descriptions?.en?.value || 'NONE'}`);
    console.log(`  frwiki: ${entity?.sitelinks?.frwiki?.title || 'NONE'}`);
    
    // Try French Wikipedia summary
    const frTitle = entity?.sitelinks?.frwiki?.title;
    if (frTitle) {
      const wRes = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(frTitle)}`, {
        headers: { 'User-Agent': 'HistoryGlobe/1.0' }
      });
      if (wRes.ok) {
        const wData = await wRes.json();
        console.log(`  FR Wikipedia: "${wData.extract?.substring(0, 150)}..."`);
      }
    }
  }
}
run().catch(console.error);
