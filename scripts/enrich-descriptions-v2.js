/**
 * Enrich descriptions v2 - smarter approach:
 * 1. First try English Wikipedia (confirmed URLs only - those starting with https://en.wikipedia.org/wiki/ and NOT guessed from name)
 * 2. For sites without English articles, try Wikidata descriptions via the API
 * 3. Only updates sites with generic descriptions
 */
const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractTitle(wikiUrl) {
  if (!wikiUrl) return null;
  try {
    const match = wikiUrl.match(/\/wiki\/(.+)/);
    if (match) return decodeURIComponent(match[1]).replace(/_/g, ' ');
  } catch {}
  return null;
}

function isGuessedUrl(site) {
  // If the URL is just the name with underscores, it's a guess
  const title = extractTitle(site.wiki_url);
  if (!title) return true;
  return title.toLowerCase().replace(/ /g, '') === site.name.toLowerCase().replace(/ /g, '');
}

async function fetchWikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
    });
    if (res.status === 404) return null;
    if (res.status === 429) { await sleep(30000); return 'RETRY'; }
    if (!res.ok) return null;
    const data = await res.json();
    // Skip disambiguation pages and very short extracts
    if (data.type === 'disambiguation') return null;
    if (data.extract && data.extract.length > 20) return data.extract;
  } catch {}
  return null;
}

async function fetchWikidataDesc(externalId) {
  if (!externalId || !externalId.startsWith('wd-')) return null;
  const qid = externalId.replace('wd-', '');
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=descriptions&languages=en&format=json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const desc = data.entities?.[qid]?.descriptions?.en?.value;
    if (desc && desc.length > 10) return desc;
  } catch {}
  return null;
}

async function run() {
  console.log('=== Description Enrichment v2 ===\n');

  const sites = await sql`
    SELECT id, name, country, wiki_url, external_id, short_description
    FROM hg_sites
    WHERE (
      short_description LIKE 'Historical site in %'
      OR short_description IS NULL
      OR short_description = ''
    )
    ORDER BY id`;

  console.log(`Sites to enrich: ${sites.length}\n`);

  // Separate into confirmed wiki URLs vs guessed
  const confirmed = sites.filter(s => s.wiki_url && s.wiki_url.includes('wikipedia.org') && !isGuessedUrl(s));
  const guessed = sites.filter(s => !s.wiki_url || !s.wiki_url.includes('wikipedia.org') || isGuessedUrl(s));

  console.log(`Confirmed Wikipedia URLs: ${confirmed.length}`);
  console.log(`Guessed/no URLs (will try Wikidata): ${guessed.length}\n`);

  let enriched = 0;
  let notFound = 0;

  // Phase 1: Confirmed Wikipedia articles
  console.log('--- Phase 1: Wikipedia summaries ---');
  for (let i = 0; i < confirmed.length; i++) {
    const s = confirmed[i];
    const title = extractTitle(s.wiki_url);
    if (!title) continue;

    let summary = await fetchWikiSummary(title);
    if (summary === 'RETRY') summary = await fetchWikiSummary(title);

    if (summary) {
      const desc = summary.length > 490 ? summary.substring(0, 487) + '...' : summary;
      try {
        await sql`UPDATE hg_sites SET short_description = ${desc} WHERE id = ${s.id}`;
        enriched++;
      } catch {}
    } else {
      notFound++;
    }

    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${confirmed.length} — enriched: ${enriched}`);
    await sleep(100);
  }
  console.log(`  Phase 1 done: ${enriched} enriched, ${notFound} not found\n`);

  // Phase 2: Wikidata descriptions for the rest
  console.log('--- Phase 2: Wikidata descriptions ---');
  let wdEnriched = 0;
  for (let i = 0; i < guessed.length; i++) {
    const s = guessed[i];
    
    // First try Wikipedia anyway (might work)
    const title = extractTitle(s.wiki_url);
    let summary = null;
    if (title) {
      summary = await fetchWikiSummary(title);
      if (summary === 'RETRY') summary = await fetchWikiSummary(title);
    }

    if (!summary && s.external_id) {
      // Fall back to Wikidata description
      summary = await fetchWikidataDesc(s.external_id);
    }

    if (summary) {
      const desc = summary.length > 490 ? summary.substring(0, 487) + '...' : summary;
      try {
        await sql`UPDATE hg_sites SET short_description = ${desc} WHERE id = ${s.id}`;
        wdEnriched++;
      } catch {}
    }

    if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${guessed.length} — enriched: ${wdEnriched}`);
    await sleep(100);
  }
  console.log(`  Phase 2 done: ${wdEnriched} enriched\n`);

  console.log(`✅ Total enriched: ${enriched + wdEnriched}`);

  const remaining = await sql`
    SELECT COUNT(*) as c FROM hg_sites
    WHERE short_description LIKE 'Historical site in %'
    OR short_description IS NULL OR short_description = ''`;
  console.log(`Remaining weak descriptions: ${remaining[0].c}`);
}

run().catch(console.error);
