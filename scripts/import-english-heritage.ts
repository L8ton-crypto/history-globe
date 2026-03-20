/**
 * Import English Heritage properties from Wikidata SPARQL
 * Gets coordinates, images, Wikipedia links, descriptions
 * Run: npx tsx scripts/import-english-heritage.ts
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

interface WikidataResult {
  item: { value: string };
  itemLabel: { value: string };
  coord: { value: string };
  image?: { value: string };
  article?: { value: string };
  inception?: { value: string };
  instanceLabel?: { value: string };
}

function parseCoord(point: string): { lat: number; lng: number } | null {
  // Format: "Point(-2.53122 52.6353)"
  const match = point.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2]),
  };
}

function wikimediaToThumb(url: string): string {
  // Convert commons URL to 330px thumbnail
  // http://commons.wikimedia.org/wiki/Special:FilePath/Filename.jpg
  // -> https://upload.wikimedia.org/wikipedia/commons/thumb/hash/Filename.jpg/330px-Filename.jpg
  // Easier: use the Special:FilePath with width parameter
  if (!url) return '';
  const filename = url.split('/').pop();
  if (!filename) return '';
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=330`;
}

function categorise(instanceLabel: string, name: string): string {
  const lower = (instanceLabel || '').toLowerCase() + ' ' + (name || '').toLowerCase();
  if (lower.includes('roman') || lower.includes('villa rustica')) return 'roman';
  if (lower.includes('castle') || lower.includes('fort') || lower.includes('tower')) return 'medieval';
  if (lower.includes('abbey') || lower.includes('priory') || lower.includes('church') || lower.includes('chapel') || lower.includes('cathedral')) return 'religious';
  if (lower.includes('stone circle') || lower.includes('barrow') || lower.includes('hillfort') || lower.includes('iron age') || lower.includes('neolithic')) return 'ancient';
  if (lower.includes('mill') || lower.includes('mine') || lower.includes('furnace') || lower.includes('industrial')) return 'industrial';
  if (lower.includes('house') || lower.includes('palace') || lower.includes('manor') || lower.includes('hall')) return 'cultural';
  return 'cultural';
}

function slugify(name: string): string {
  return 'eh-' + name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 60).replace(/-$/, '');
}

async function main() {
  console.log('=== English Heritage Import from Wikidata ===\n');

  // SPARQL query for English Heritage managed properties
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?coord ?image ?article ?inception ?instanceLabel WHERE {
      ?item wdt:P137 wd:Q936287 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P571 ?inception . }
      OPTIONAL { ?item wdt:P31 ?instance . }
      OPTIONAL {
        ?article schema:about ?item .
        ?article schema:isPartOf <https://en.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
  `;

  console.log('Querying Wikidata SPARQL...');
  const encoded = encodeURIComponent(query);
  const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encoded}`, {
    headers: { 'User-Agent': 'HistoryGlobe/1.0 (https://history-globe-sigma.vercel.app)' },
  });

  const data = await response.json();
  const results: WikidataResult[] = data.results.bindings;
  console.log(`Raw results: ${results.length}`);

  // Deduplicate by Wikidata item ID
  const seen = new Map<string, WikidataResult>();
  for (const r of results) {
    const id = r.item.value;
    if (!seen.has(id)) {
      seen.set(id, r);
    } else {
      // Keep the one with an image if possible
      const existing = seen.get(id)!;
      if (!existing.image && r.image) {
        seen.set(id, r);
      }
    }
  }

  const unique = Array.from(seen.values());
  console.log(`Unique sites: ${unique.length}`);

  // Get source ID
  const sourceResult = await sql`SELECT id FROM hg_sources WHERE name = 'english_heritage'`;
  const sourceId = sourceResult[0].id;

  // Check existing
  const existing = await sql`SELECT external_id FROM hg_sites WHERE source_id = ${sourceId}`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Already in DB: ${existingIds.size}`);

  let inserted = 0;
  let skipped = 0;
  let withImage = 0;

  for (const r of unique) {
    const coord = parseCoord(r.coord.value);
    if (!coord) continue;

    const name = r.itemLabel.value;
    const id = slugify(name);

    if (existingIds.has(id)) {
      skipped++;
      continue;
    }

    const imageUrl = r.image ? wikimediaToThumb(r.image.value) : '';
    const wikiUrl = r.article?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
    const era = r.inception?.value ? r.inception.value.substring(0, 4) : 'Medieval';
    const category = categorise(r.instanceLabel?.value || '', name);

    try {
      await sql`
        INSERT INTO hg_sites (
          external_id, name, lat, lng, category, era,
          short_description, long_description, wiki_url, image_url,
          country, region, unesco, significance, source_id, source_ref,
          geog
        ) VALUES (
          ${id}, ${name}, ${coord.lat}, ${coord.lng}, ${category}, ${era},
          ${'English Heritage property. ' + (r.instanceLabel?.value || 'Historic site') + '.'},
          ${''},
          ${wikiUrl}, ${imageUrl},
          ${'England'}, ${''},
          ${false}, ${4},
          ${sourceId}, ${r.item.value},
          ST_SetSRID(ST_MakePoint(${coord.lng}, ${coord.lat}), 4326)::geography
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
      if (imageUrl) withImage++;
    } catch (e: any) {
      // skip
    }

    if (inserted % 50 === 0 && inserted > 0) {
      console.log(`  Inserted: ${inserted} (${withImage} with images)`);
    }
  }

  // Now enrich descriptions from Wikipedia
  console.log('\nEnriching descriptions from Wikipedia...');
  const ehSites = await sql`
    SELECT id, wiki_url FROM hg_sites 
    WHERE source_id = ${sourceId} AND (long_description = '' OR long_description IS NULL)
    LIMIT 500
  `;

  let enriched = 0;
  for (const site of ehSites) {
    const title = site.wiki_url?.split('/wiki/')?.pop();
    if (!title) continue;

    try {
      const wikiResp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'HistoryGlobe/1.0' } }
      );

      if (wikiResp.ok) {
        const wikiData = await wikiResp.json();
        if (wikiData.extract && wikiData.extract.length > 30) {
          const shortDesc = wikiData.extract.length > 300 ? wikiData.extract.substring(0, 300) + '...' : wikiData.extract;
          await sql`
            UPDATE hg_sites SET 
              short_description = ${shortDesc},
              long_description = ${wikiData.extract}
            WHERE id = ${site.id}
          `;

          // Also update image if we got one from Wikipedia
          if (wikiData.thumbnail?.source) {
            await sql`
              UPDATE hg_sites SET image_url = ${wikiData.thumbnail.source}
              WHERE id = ${site.id} AND (image_url = '' OR image_url IS NULL)
            `;
          }

          enriched++;
        }
      }
    } catch {
      // skip
    }

    if (enriched % 25 === 0 && enriched > 0) {
      console.log(`  Enriched: ${enriched}`);
    }

    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  // Update source count
  const countResult = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE source_id = ${sourceId}`;
  await sql`UPDATE hg_sources SET site_count = ${parseInt(countResult[0].c)}, last_imported_at = NOW() WHERE id = ${sourceId}`;

  const totalSites = await sql`SELECT COUNT(*) as c FROM hg_sites`;

  console.log(`\n✅ English Heritage import complete!`);
  console.log(`   New sites inserted: ${inserted}`);
  console.log(`   With images: ${withImage}`);
  console.log(`   Descriptions enriched: ${enriched}`);
  console.log(`   Skipped (existing): ${skipped}`);
  console.log(`   Total sites in DB: ${totalSites[0].c}`);
}

main().catch(console.error);
