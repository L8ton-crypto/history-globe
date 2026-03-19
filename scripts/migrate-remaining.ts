import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

interface Site {
  id: string; name: string; lat: number; lng: number;
  category: string; era: string; shortDescription: string;
  longDescription: string; imageUrl: string; wikiUrl: string;
  country: string; region: string; unesco: boolean; significance: number;
}

async function main() {
  const importedSites: Site[] = JSON.parse(
    readFileSync(join(__dirname, '..', 'src', 'data', 'imported-sites.json'), 'utf-8')
  );
  
  // Check what's already in
  const existing = await sql`SELECT external_id FROM hg_sites`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Already in DB: ${existingIds.size}`);
  
  const remaining = importedSites.filter(s => !existingIds.has(s.id));
  console.log(`Remaining to insert: ${remaining.length}`);
  
  const cadwId = (await sql`SELECT id FROM hg_sources WHERE name = 'cadw'`)[0].id;
  const unescoId = (await sql`SELECT id FROM hg_sources WHERE name = 'unesco'`)[0].id;
  
  let inserted = 0;
  for (let i = 0; i < remaining.length; i++) {
    const site = remaining[i];
    const sourceId = site.id.startsWith('cadw-') ? cadwId : unescoId;
    
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
      // skip
    }
    
    if ((i + 1) % 200 === 0) {
      console.log(`  ${i + 1}/${remaining.length} (${inserted} inserted)`);
      // Small delay to avoid overwhelming connection pool
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  // Update counts
  const cadwCount = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE source_id = ${cadwId}`;
  const unescoCount = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE source_id = ${unescoId}`;
  await sql`UPDATE hg_sources SET site_count = ${parseInt(cadwCount[0].c)}, last_imported_at = NOW() WHERE id = ${cadwId}`;
  await sql`UPDATE hg_sources SET site_count = ${parseInt(unescoCount[0].c)}, last_imported_at = NOW() WHERE id = ${unescoId}`;
  
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  console.log(`\n✅ Done! Inserted ${inserted} more sites`);
  console.log(`📊 Total in DB: ${total[0].c}`);
  console.log(`   Cadw: ${cadwCount[0].c}`);
  console.log(`   UNESCO: ${unescoCount[0].c}`);
}

main().catch(console.error);
