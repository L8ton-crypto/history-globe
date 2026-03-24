/**
 * Enrich weak descriptions using Wikipedia REST API summaries.
 * Only updates sites with generic "Historical site in X" or empty descriptions.
 * Uses Wikipedia's /page/summary endpoint for clean first-paragraph extracts.
 */
const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractTitle(wikiUrl) {
  if (!wikiUrl) return null;
  try {
    const url = new URL(wikiUrl);
    const path = url.pathname;
    // /wiki/Article_Name
    const match = path.match(/\/wiki\/(.+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {}
  return null;
}

async function fetchSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
    });
    if (res.status === 404) return null;
    if (res.status === 429) {
      console.log('  Rate limited, waiting 30s...');
      await sleep(30000);
      return 'RETRY';
    }
    if (!res.ok) return null;
    const data = await res.json();
    return data.extract || null;
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== Wikipedia Description Enrichment ===\n');

  // Get all sites with weak descriptions and a wiki_url
  const sites = await sql`
    SELECT id, name, country, wiki_url, short_description
    FROM hg_sites
    WHERE wiki_url IS NOT NULL AND wiki_url != ''
    AND wiki_url LIKE 'https://en.wikipedia%'
    AND (
      short_description LIKE 'Historical site in %'
      OR short_description IS NULL
      OR short_description = ''
    )
    ORDER BY id`;

  console.log(`Sites to enrich: ${sites.length}\n`);

  let enriched = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const title = extractTitle(s.wiki_url);
    if (!title) { skipped++; continue; }

    let summary = await fetchSummary(title);
    
    // Retry once on rate limit
    if (summary === 'RETRY') {
      summary = await fetchSummary(title);
      if (summary === 'RETRY') summary = null;
    }

    if (!summary) {
      notFound++;
      // Try without underscores (some URLs use spaces)
      continue;
    }

    // Truncate to 490 chars
    const desc = summary.length > 490 ? summary.substring(0, 487) + '...' : summary;

    try {
      await sql`UPDATE hg_sites SET short_description = ${desc} WHERE id = ${s.id}`;
      enriched++;
    } catch (e) {
      errors++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${sites.length} — enriched: ${enriched}, not found: ${notFound}, errors: ${errors}`);
    }

    // 150ms delay - well under Wikipedia's 200 req/s limit
    await sleep(150);
  }

  console.log(`\n✅ Done!`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Not found on Wikipedia: ${notFound}`);
  console.log(`  Skipped (no title): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Check remaining weak descriptions
  const remaining = await sql`
    SELECT COUNT(*) as c FROM hg_sites
    WHERE short_description LIKE 'Historical site in %'
    OR short_description IS NULL OR short_description = ''`;
  console.log(`\nRemaining weak descriptions: ${remaining[0].c}`);
}

run().catch(console.error);
