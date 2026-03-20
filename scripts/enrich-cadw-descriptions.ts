/**
 * Enrich Cadw sites with proper descriptions from Cadw's report API
 * Run: npx tsx scripts/enrich-cadw-descriptions.ts
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function fetchCadwDescription(recordNumber: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?lang=en&id=${recordNumber}`,
      { headers: { 'User-Agent': 'HistoryGlobe/1.0' } }
    );

    if (!response.ok) return null;

    const html = await response.text();

    // Extract the description section - it's between "Description" heading and the end
    const descMatch = html.match(/Summary Description and Reason for Designation<\/h5>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!descMatch) return null;

    // Clean HTML tags
    let desc = descMatch[1]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return desc.length > 20 ? desc : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Cadw Description Enrichment ===\n');

  // Get Cadw sites that still have generic descriptions
  const sites = await sql`
    SELECT id, external_id, name, source_ref
    FROM hg_sites 
    WHERE source_id = (SELECT id FROM hg_sources WHERE name = 'cadw')
      AND (short_description LIKE '%Classified as%' OR short_description LIKE 'A %in %, Wales.%')
    ORDER BY significance DESC, id
  `;

  console.log(`Sites with generic descriptions: ${sites.length}`);

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];

    // Extract record number from external_id or try sequential
    // The Cadw WFS data has RecordNumber which maps to the report API id
    // We need to find the right ID - let's try matching by name via sequential scan
    // Actually the external_id format is "cadw-name-slug" and source_ref is the same
    // We stored RecordNumber... let me check what we have

    // For now, try the site's DB id offset - this won't be perfect
    // Better approach: we need to re-query Cadw WFS to get RecordNumber
    // Let's just try fetching by incrementing IDs and matching names

    // Skip for now - we need RecordNumber which we didn't store
    // TODO: Re-import with RecordNumber stored as source_ref

    if (i === 0) {
      console.log('Note: Need RecordNumber from Cadw to fetch descriptions.');
      console.log('Will re-query Cadw WFS for record numbers...\n');
      break;
    }
  }

  // Better approach: query Cadw WFS for names + record numbers, then match
  console.log('Fetching Cadw record numbers from WFS...');

  const batchSize = 500;
  let startIndex = 0;
  let total = 0;
  const cadwRecords = new Map<string, number>(); // name -> RecordNumber

  do {
    const url = `https://datamap.gov.wales/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=inspire-wg:Cadw_SAM&startIndex=${startIndex}&count=${batchSize}&outputFormat=application/json&propertyName=RecordNumber,Name`;

    const response = await fetch(url);
    const data = await response.json();
    total = data.totalFeatures;

    for (const feature of data.features) {
      const name = (feature.properties.Name || '').trim();
      const recordNum = feature.properties.RecordNumber;
      if (name && recordNum) {
        cadwRecords.set(name.toLowerCase(), recordNum);
      }
    }

    startIndex += batchSize;
    console.log(`  Loaded ${cadwRecords.size} record mappings...`);
    await new Promise(r => setTimeout(r, 300));
  } while (startIndex < total);

  console.log(`Total Cadw records mapped: ${cadwRecords.size}\n`);

  // Now fetch descriptions for sites with generic text
  const genericSites = await sql`
    SELECT id, name
    FROM hg_sites 
    WHERE source_id = (SELECT id FROM hg_sources WHERE name = 'cadw')
      AND (short_description LIKE '%Classified as%' OR short_description LIKE 'A %in %, Wales.%')
    ORDER BY significance DESC
    LIMIT 2000
  `;

  console.log(`Enriching top ${genericSites.length} sites with Cadw descriptions...\n`);

  for (let i = 0; i < genericSites.length; i++) {
    const site = genericSites[i];
    const recordNum = cadwRecords.get(site.name.toLowerCase().trim());

    if (!recordNum) {
      failed++;
      continue;
    }

    const desc = await fetchCadwDescription(recordNum);

    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + '...' : desc;

      await sql`
        UPDATE hg_sites 
        SET short_description = ${shortDesc},
            long_description = ${desc}
        WHERE id = ${site.id}
      `;
      enriched++;
    } else {
      failed++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${genericSites.length} - Enriched: ${enriched} | Failed: ${failed}`);
    }

    // Rate limit - be gentle with Cadw's API
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Description enrichment complete!`);
  console.log(`   Enriched: ${enriched}`);
  console.log(`   Failed/no match: ${failed}`);
}

main().catch(console.error);
