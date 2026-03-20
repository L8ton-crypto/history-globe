/**
 * Fetch images from Wikidata (not Wikipedia) for sites missing images
 * Wikidata has a separate rate limit from Wikipedia REST API
 */
import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

function commonsToThumb(url: string): string {
  const filename = decodeURIComponent(url.split('/').pop() || '');
  if (!filename) return '';
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=330`;
}

async function fetchWikidataBatch(query: string): Promise<any[]> {
  const encoded = encodeURIComponent(query);
  const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encoded}`, {
    headers: { 'User-Agent': 'HistoryGlobe/1.0 (https://history-globe-sigma.vercel.app)' },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results?.bindings || [];
}

async function main() {
  console.log('=== Wikidata Image Enrichment ===\n');

  // Query for multiple types of heritage sites in UK with images
  const queries = [
    // Castles in UK
    'SELECT ?item ?itemLabel ?coord ?image WHERE { ?item wdt:P31 wd:Q23413 . ?item wdt:P17 wd:Q145 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
    // Abbeys in UK
    'SELECT ?item ?itemLabel ?coord ?image WHERE { ?item wdt:P31 wd:Q160742 . ?item wdt:P17 wd:Q145 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
    // Roman forts in UK 
    'SELECT ?item ?itemLabel ?coord ?image WHERE { ?item wdt:P31 wd:Q1777301 . ?item wdt:P17 wd:Q145 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 200',
    // Archaeological sites in UK
    'SELECT ?item ?itemLabel ?coord ?image WHERE { ?item wdt:P31 wd:Q839954 . ?item wdt:P17 wd:Q145 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
    // Scheduled monuments with images
    'SELECT ?item ?itemLabel ?coord ?image WHERE { ?item wdt:P1435 wd:Q219538 . ?item wdt:P625 ?coord . ?item wdt:P18 ?image . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } } LIMIT 500',
  ];

  // Collect all Wikidata results
  const nameToImage = new Map<string, string>();

  for (let q = 0; q < queries.length; q++) {
    console.log(`Running query ${q + 1}/${queries.length}...`);
    const results = await fetchWikidataBatch(queries[q]);
    console.log(`  Got ${results.length} results`);

    for (const r of results) {
      const name = r.itemLabel?.value;
      const imageUrl = r.image?.value;
      if (name && imageUrl) {
        nameToImage.set(name.toLowerCase(), commonsToThumb(imageUrl));
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nTotal unique sites with images: ${nameToImage.size}`);

  // Match against our DB sites that lack images
  const sites = await sql`
    SELECT id, name FROM hg_sites 
    WHERE (image_url = '' OR image_url IS NULL)
    ORDER BY significance DESC
  `;

  console.log(`DB sites without images: ${sites.length}`);

  let matched = 0;
  for (const site of sites) {
    const imageUrl = nameToImage.get(site.name.toLowerCase().trim());
    if (imageUrl) {
      await sql`UPDATE hg_sites SET image_url = ${imageUrl} WHERE id = ${site.id}`;
      await sql`
        INSERT INTO hg_site_images (site_id, image_url, thumbnail_url)
        VALUES (${site.id}, ${imageUrl}, ${imageUrl})
        ON CONFLICT (site_id) DO UPDATE SET image_url = ${imageUrl}, fetched_at = NOW()
      `;
      matched++;
    }
  }

  const walesImages = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND image_url != '' AND image_url IS NOT NULL`;
  const totalImages = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE image_url != '' AND image_url IS NOT NULL`;

  console.log(`\n✅ Done!`);
  console.log(`   Matched & updated: ${matched}`);
  console.log(`   Welsh sites with images: ${walesImages[0].c}`);
  console.log(`   Total sites with images: ${totalImages[0].c}`);
}
main().catch(console.error);
