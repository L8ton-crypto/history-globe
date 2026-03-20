/**
 * Enrich Cadw sites with descriptions from Cadw report API (v2 - fixed name matching)
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function fetchCadwDescription(recordNumber: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?lang=en&id=${recordNumber}`
    );
    if (!response.ok) return null;
    const html = await response.text();

    // Description is in a panel-body div after "Summary Description and Reason for Designation"
    const match = html.match(/Summary Description and Reason for Designation<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    if (!match) return null;

    let desc = match[1]
      .replace(/The following provides a general description of the Scheduled Ancient Monument\.\s*/i, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return desc.length > 30 ? desc : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Cadw Description Enrichment v2 ===\n');

  // Build name -> RecordNumber map from WFS
  console.log('Building name -> RecordNumber map from Cadw WFS...');
  const cadwRecords = new Map<string, number>();
  let startIndex = 0;
  let total = 0;

  do {
    const url = `https://datamap.gov.wales/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=inspire-wg:Cadw_SAM&startIndex=${startIndex}&count=500&outputFormat=application/json&propertyName=RecordNumber,Name`;
    const response = await fetch(url);
    const data = await response.json();
    total = data.totalFeatures;

    for (const feature of data.features) {
      const name = (feature.properties.Name || '').trim().toLowerCase();
      const recordNum = feature.properties.RecordNumber;
      if (name && recordNum) {
        cadwRecords.set(name, recordNum);
      }
    }
    startIndex += 500;
    await new Promise(r => setTimeout(r, 300));
  } while (startIndex < total);

  console.log(`Mapped ${cadwRecords.size} records\n`);

  // Get DB sites needing enrichment
  const sites = await sql`
    SELECT id, name FROM hg_sites
    WHERE source_id = (SELECT id FROM hg_sources WHERE name = 'cadw')
      AND (short_description LIKE '%Classified as%' OR short_description LIKE 'A %in %, Wales.%')
    ORDER BY significance DESC
    LIMIT 4000
  `;

  console.log(`Sites to enrich: ${sites.length}`);

  // Test matching
  let matched = 0;
  let unmatched = 0;
  for (const site of sites.slice(0, 10)) {
    const key = site.name.trim().toLowerCase();
    const rec = cadwRecords.get(key);
    console.log(`  "${key}" -> ${rec || 'NOT FOUND'}`);
    if (rec) matched++; else unmatched++;
  }
  console.log(`  Test match rate: ${matched}/${matched + unmatched}\n`);

  if (matched === 0) {
    console.log('ERROR: No matches found. Aborting.');
    return;
  }

  // Now fetch descriptions
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const key = site.name.trim().toLowerCase();
    const recordNum = cadwRecords.get(key);

    if (!recordNum) {
      failed++;
      continue;
    }

    const desc = await fetchCadwDescription(recordNum);

    if (desc && desc.length > 30) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + '...' : desc;
      await sql`
        UPDATE hg_sites SET short_description = ${shortDesc}, long_description = ${desc}
        WHERE id = ${site.id}
      `;
      enriched++;
    } else {
      failed++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${sites.length} - Enriched: ${enriched} | Failed: ${failed}`);
    }

    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n✅ Done! Enriched: ${enriched} | Failed: ${failed}`);
}

main().catch(console.error);
