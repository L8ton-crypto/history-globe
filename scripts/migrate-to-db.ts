/**
 * Migrate existing JSON/TS sites into Postgres
 * Run: npx tsx scripts/migrate-to-db.ts
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  era: string;
  shortDescription: string;
  longDescription: string;
  imageUrl: string;
  wikiUrl: string;
  country: string;
  region: string;
  unesco: boolean;
  significance: number;
}

async function getSourceId(name: string): Promise<number> {
  const result = await sql`SELECT id FROM hg_sources WHERE name = ${name}`;
  return result[0].id;
}

async function insertSites(sites: Site[], sourceId: number, sourceName: string): Promise<number> {
  let inserted = 0;
  const batchSize = 100;
  
  for (let i = 0; i < sites.length; i += batchSize) {
    const batch = sites.slice(i, i + batchSize);
    
    for (const site of batch) {
      try {
        await sql`
          INSERT INTO hg_sites (
            external_id, name, lat, lng, category, era,
            short_description, long_description, wiki_url, image_url,
            country, region, unesco, significance, source_id, source_ref,
            geog
          ) VALUES (
            ${site.id}, ${site.name}, ${site.lat}, ${site.lng}, ${site.category}, ${site.era},
            ${site.shortDescription || ''}, ${site.longDescription || ''}, 
            ${site.wikiUrl || ''}, ${site.imageUrl || ''},
            ${site.country || ''}, ${site.region || ''}, 
            ${site.unesco || false}, ${site.significance || 3}, 
            ${sourceId}, ${site.id},
            ST_SetSRID(ST_MakePoint(${site.lng}, ${site.lat}), 4326)::geography
          )
          ON CONFLICT DO NOTHING
        `;
        inserted++;
      } catch (e: any) {
        // Skip invalid entries silently
        if (!e.message?.includes('duplicate')) {
          console.error(`  Error inserting ${site.name}: ${e.message?.substring(0, 80)}`);
        }
      }
    }
    
    if ((i + batchSize) % 500 === 0 || i + batchSize >= sites.length) {
      console.log(`  ${sourceName}: ${Math.min(i + batchSize, sites.length)}/${sites.length} processed (${inserted} inserted)`);
    }
  }
  
  return inserted;
}

async function main() {
  console.log('=== HistoryGlobe Database Migration ===\n');
  
  // Get source IDs
  const manualId = await getSourceId('manual');
  const cadwId = await getSourceId('cadw');
  const unescoId = await getSourceId('unesco');
  
  // Load manual sites from sites.ts
  // We need to extract the array from the TS file
  console.log('Loading manual sites...');
  const sitesTs = readFileSync(join(__dirname, '..', 'src', 'data', 'sites.ts'), 'utf-8');
  
  // Extract the array content between [ and final ];
  const arrayStart = sitesTs.indexOf('historicalSites: HistoricalSite[] = [');
  if (arrayStart === -1) {
    console.error('Could not find historicalSites array');
    return;
  }
  const start = sitesTs.indexOf('[', arrayStart);
  const end = sitesTs.lastIndexOf('];');
  const arrayContent = sitesTs.substring(start, end + 1);
  
  // Convert TS object literal to JSON (handle single quotes, trailing commas, etc.)
  let jsonStr = arrayContent
    .replace(/\/\/[^\n]*/g, '') // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/(\w+):/g, '"$1":') // quote keys
    .replace(/'/g, '"') // single to double quotes
    .replace(/,\s*}/g, '}') // trailing commas in objects
    .replace(/,\s*]/g, ']') // trailing commas in arrays
    .replace(/\\"/g, '\\\\"'); // escape already-escaped quotes
  
  // This is fragile - let's use a different approach for manual sites
  // Just load the imported JSON directly
  console.log('Loading imported sites...');
  const importedSites: Site[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'src', 'data', 'imported-sites.json'), 'utf-8')
  );
  
  // Separate Cadw and UNESCO sites from imported
  const cadwSites = importedSites.filter(s => s.id.startsWith('cadw-'));
  const unescoSites = importedSites.filter(s => s.id.startsWith('unesco-'));
  
  console.log(`\nSites to migrate:`);
  console.log(`  Cadw: ${cadwSites.length}`);
  console.log(`  UNESCO: ${unescoSites.length}`);
  console.log(`  (Manual sites from sites.ts will be handled separately)\n`);
  
  // Insert Cadw sites
  console.log('Inserting Cadw sites...');
  const cadwInserted = await insertSites(cadwSites, cadwId, 'Cadw');
  
  // Insert UNESCO sites
  console.log('Inserting UNESCO sites...');
  const unescoInserted = await insertSites(unescoSites, unescoId, 'UNESCO');
  
  // Update source counts
  await sql`UPDATE hg_sources SET site_count = ${cadwInserted}, last_imported_at = NOW() WHERE id = ${cadwId}`;
  await sql`UPDATE hg_sources SET site_count = ${unescoInserted}, last_imported_at = NOW() WHERE id = ${unescoId}`;
  
  // Final count
  const countResult = await sql`SELECT COUNT(*) as count FROM hg_sites`;
  console.log(`\n✅ Migration complete!`);
  console.log(`📊 Total sites in database: ${countResult[0].count}`);
  console.log(`   Cadw: ${cadwInserted}`);
  console.log(`   UNESCO: ${unescoInserted}`);
  
  // Sample data check
  const sample = await sql`SELECT name, country, category FROM hg_sites ORDER BY RANDOM() LIMIT 5`;
  console.log('\n📋 Sample sites:');
  sample.forEach(s => console.log(`   ${s.name} (${s.country}) [${s.category}]`));
  
  // Spatial query test
  const walesSites = await sql`
    SELECT COUNT(*) as count FROM hg_sites 
    WHERE lat BETWEEN 51.3 AND 53.5 AND lng BETWEEN -5.5 AND -2.5
  `;
  console.log(`\n🏴 Sites in Wales bounding box: ${walesSites[0].count}`);
}

main().catch(console.error);
