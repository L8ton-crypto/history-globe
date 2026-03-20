/**
 * Import historically important Grade I sites from Historic England NHLE
 * Filters for castles, abbeys, cathedrals, Roman sites, forts, palaces, ruins
 */
import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const BASE_URL = 'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query';

// BNG to WGS84 conversion (same as import-data.ts)
function bngToLatLng(easting: number, northing: number): { lat: number; lng: number } {
  const a = 6377563.396, b = 6356256.909, F0 = 0.9996012717;
  const lat0 = (49 * Math.PI) / 180, lng0 = (-2 * Math.PI) / 180;
  const N0 = -100000, E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  let lat = lat0, M = 0;
  do {
    lat = ((northing - N0 - M) / (a * F0)) + lat;
    const Ma = (1 + n + (5/4)*n*n + (5/4)*n*n*n) * (lat - lat0);
    const Mb = (3*n + 3*n*n + (21/8)*n*n*n) * Math.sin(lat-lat0) * Math.cos(lat+lat0);
    const Mc = ((15/8)*n*n + (15/8)*n*n*n) * Math.sin(2*(lat-lat0)) * Math.cos(2*(lat+lat0));
    const Md = (35/24)*n*n*n * Math.sin(3*(lat-lat0)) * Math.cos(3*(lat+lat0));
    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (northing - N0 - M >= 0.00001);
  const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
  const nu = a * F0 / Math.sqrt(1 - e2*sinLat*sinLat);
  const rho = a * F0 * (1-e2) / Math.pow(1-e2*sinLat*sinLat, 1.5);
  const eta2 = nu/rho - 1, tanLat = Math.tan(lat);
  const VII = tanLat / (2*rho*nu);
  const VIII = tanLat / (24*rho*nu*nu*nu) * (5 + 3*tanLat*tanLat + eta2 - 9*tanLat*tanLat*eta2);
  const IX = tanLat / (720*rho*Math.pow(nu,5)) * (61 + 90*tanLat*tanLat + 45*Math.pow(tanLat,4));
  const X = 1 / (cosLat*nu);
  const XI = 1 / (6*cosLat*nu*nu*nu) * (nu/rho + 2*tanLat*tanLat);
  const XII = 1 / (120*cosLat*Math.pow(nu,5)) * (5 + 28*tanLat*tanLat + 24*Math.pow(tanLat,4));
  const dE = easting - E0;
  const latRad = lat - VII*dE*dE + VIII*Math.pow(dE,4) - IX*Math.pow(dE,6);
  const lngRad = lng0 + X*dE - XI*Math.pow(dE,3) + XII*Math.pow(dE,5);
  return { lat: Math.round((latRad*180/Math.PI)*10000)/10000, lng: Math.round((lngRad*180/Math.PI)*10000)/10000 };
}

function categorise(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('roman') || n.includes('villa ') || n.includes('amphitheatre') || n.includes('bath house')) return 'roman';
  if (n.includes('castle') || n.includes('fort') || n.includes('tower') || n.includes('wall')) return 'medieval';
  if (n.includes('abbey') || n.includes('priory') || n.includes('cathedral') || n.includes('church') || n.includes('chapel') || n.includes('monastery') || n.includes('temple')) return 'religious';
  if (n.includes('palace') || n.includes('hall') || n.includes('manor') || n.includes('house')) return 'cultural';
  if (n.includes('ruin') || n.includes('barrow') || n.includes('stone') || n.includes('circle') || n.includes('henge')) return 'ancient';
  if (n.includes('mill') || n.includes('mine') || n.includes('bridge') || n.includes('barn')) return 'industrial';
  return 'cultural';
}

function slugify(name: string): string {
  return 'he-' + name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 60).replace(/-$/, '');
}

async function main() {
  console.log('=== Historic England Grade I Import ===\n');

  const sourceResult = await sql`SELECT id FROM hg_sources WHERE name = 'historic_england'`;
  const sourceId = sourceResult[0].id;

  // Existing check
  const existing = await sql`SELECT external_id FROM hg_sites WHERE source_id = ${sourceId}`;
  const existingIds = new Set(existing.map(r => r.external_id));
  console.log(`Already in DB from HE: ${existingIds.size}`);

  // Keywords for historically important sites
  const keywords = ['Castle', 'Abbey', 'Priory', 'Cathedral', 'Roman', 'Fort', 'Palace', 'Ruin', 'Monastery'];
  
  let totalInserted = 0;

  for (const keyword of keywords) {
    let offset = 0;
    const batchSize = 200;
    let keywordCount = 0;

    while (true) {
      const url = `${BASE_URL}?where=Grade%3D'I'+AND+Name+LIKE+'%25${keyword}%25'&outFields=ListEntry,Name,Grade,hyperlink,Easting,Northing&returnGeometry=false&resultRecordCount=${batchSize}&resultOffset=${offset}&f=json`;
      
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (!data.features || data.features.length === 0) break;

      for (const feature of data.features) {
        const a = feature.attributes;
        if (!a.Easting || !a.Northing || !a.Name) continue;

        const id = slugify(a.Name);
        if (existingIds.has(id)) continue;

        const { lat, lng } = bngToLatLng(a.Easting, a.Northing);
        
        // Skip if outside England roughly
        if (lat < 49.9 || lat > 55.9 || lng < -6.5 || lng > 2.0) continue;

        const wikiName = a.Name.replace(/\s+/g, '_').replace(/'/g, '%27');

        try {
          await sql`
            INSERT INTO hg_sites (
              external_id, name, lat, lng, category, era,
              short_description, long_description, wiki_url, image_url,
              country, region, unesco, significance, source_id, source_ref,
              geog
            ) VALUES (
              ${id}, ${a.Name}, ${lat}, ${lng}, ${categorise(a.Name)}, ${'Grade I Listed'},
              ${'Grade I listed building - of exceptional national interest.'},
              ${'This is a Grade I listed building on the National Heritage List for England, recognised as being of exceptional interest. Only 2.5% of listed buildings are Grade I.'},
              ${'https://en.wikipedia.org/wiki/' + wikiName}, ${''},
              ${'England'}, ${''},
              ${false}, ${4},
              ${sourceId}, ${a.hyperlink || ''},
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
            )
            ON CONFLICT DO NOTHING
          `;
          totalInserted++;
          keywordCount++;
          existingIds.add(id);
        } catch {}
      }

      offset += batchSize;
      if (data.features.length < batchSize) break;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`  ${keyword}: ${keywordCount} inserted`);
  }

  // Update source count
  const countResult = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE source_id = ${sourceId}`;
  await sql`UPDATE hg_sources SET site_count = ${parseInt(countResult[0].c)}, last_imported_at = NOW() WHERE id = ${sourceId}`;

  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  console.log(`\n✅ Import complete!`);
  console.log(`   New sites: ${totalInserted}`);
  console.log(`   Total in DB: ${total[0].c}`);
}

main().catch(console.error);
