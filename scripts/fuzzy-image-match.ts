/**
 * Fuzzy match Wikidata images to DB sites
 * Handles Cadw's compound Welsh/English names
 */
import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

function commonsToThumb(url: string): string {
  const filename = decodeURIComponent(url.split('/').pop() || '');
  return filename ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=330` : '';
}

function normalise(name: string): string[] {
  // Generate multiple search keys from a Cadw-style name
  const clean = name.toLowerCase().trim();
  const keys = [clean];
  
  // Split on " / " (Welsh/English)
  if (clean.includes(' / ')) {
    clean.split(' / ').forEach(p => keys.push(p.trim()));
  }
  // Split on ": " (sub-sections)
  if (clean.includes(': ')) {
    keys.push(clean.split(': ')[0].trim());
  }
  // Remove parenthetical
  const noParen = clean.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (noParen !== clean) keys.push(noParen);
  // Remove "remains of", "site of", etc
  const noPrefix = clean.replace(/^(remains of |site of |area of )/i, '').trim();
  if (noPrefix !== clean) keys.push(noPrefix);
  
  return [...new Set(keys)];
}

async function fetchWikidataBatch(query: string): Promise<any[]> {
  const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'HistoryGlobe/1.0' },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results?.bindings || [];
}

async function main() {
  console.log('=== Fuzzy Wikidata Image Match ===\n');

  const queries = [
    'SELECT ?item ?itemLabel ?image WHERE { ?item wdt:P31 wd:Q23413 . ?item wdt:P17 wd:Q145 . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
    'SELECT ?item ?itemLabel ?image WHERE { ?item wdt:P31 wd:Q160742 . ?item wdt:P17 wd:Q145 . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
    'SELECT ?item ?itemLabel ?image WHERE { ?item wdt:P31 wd:Q839954 . ?item wdt:P17 wd:Q145 . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
    'SELECT ?item ?itemLabel ?image WHERE { ?item wdt:P1435 wd:Q219538 . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
  ];

  const wdImages = new Map<string, string>(); // normalised name -> thumb URL

  for (let i = 0; i < queries.length; i++) {
    console.log(`Query ${i + 1}/${queries.length}...`);
    const results = await fetchWikidataBatch(queries[i]);
    for (const r of results) {
      const name = r.itemLabel?.value?.toLowerCase()?.trim();
      const url = r.image?.value;
      if (name && url) wdImages.set(name, commonsToThumb(url));
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`Wikidata images: ${wdImages.size}\n`);

  // Get DB sites without images
  const sites = await sql`
    SELECT id, name FROM hg_sites
    WHERE (image_url = '' OR image_url IS NULL)
      AND significance >= 2
    ORDER BY significance DESC
  `;
  console.log(`DB sites to check: ${sites.length}`);

  let matched = 0;
  for (const site of sites) {
    const keys = normalise(site.name);
    let imageUrl = '';
    for (const key of keys) {
      const found = wdImages.get(key);
      if (found) { imageUrl = found; break; }
    }

    if (imageUrl) {
      await sql`UPDATE hg_sites SET image_url = ${imageUrl} WHERE id = ${site.id}`;
      await sql`INSERT INTO hg_site_images (site_id, image_url, thumbnail_url) VALUES (${site.id}, ${imageUrl}, ${imageUrl}) ON CONFLICT (site_id) DO UPDATE SET image_url = ${imageUrl}, fetched_at = NOW()`;
      matched++;
      if (matched <= 20) console.log(`  ✅ ${site.name} -> matched`);
    }
  }

  const walesImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND image_url != '' AND image_url IS NOT NULL`;
  const totalImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE image_url != '' AND image_url IS NOT NULL`;
  console.log(`\n✅ Fuzzy matched: ${matched}`);
  console.log(`   Welsh images: ${walesImg[0].c}`);
  console.log(`   Total images: ${totalImg[0].c}`);
}
main().catch(console.error);
