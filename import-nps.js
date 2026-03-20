const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const API_KEY = 'DEMO_KEY'; // NPS allows demo key for moderate use

function guessCategory(designation, topics) {
  const d = designation.toLowerCase();
  const t = topics.map(x => x.name).join(' ').toLowerCase();
  
  if (/battlefield|military park|memorial/i.test(d)) return 'cultural';
  if (/archaeological|prehistoric|ancient/i.test(t)) return 'ancient';
  if (/church|mission|religious/i.test(t)) return 'religious';
  if (/industrial|canal|railroad|mine/i.test(t)) return 'industrial';
  if (/national park(?!way)|preserve|seashore|lakeshore|river|scenic|trail/i.test(d)) return 'natural';
  if (/fort|castle/i.test(d)) return 'medieval';
  return 'cultural';
}

async function run() {
  console.log('=== NPS API Import ===\n');
  
  // Get existing NPS sites to avoid duplicates
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'nps-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  
  // Also check by name proximity for Wikidata imports
  const existingNames = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country = 'United States'`;
  const nameSet = new Set(existingNames.map(r => r.name));
  
  console.log(`Existing NPS: ${existingIds.size}, US sites by name: ${nameSet.size}\n`);
  
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  
  let start = 0;
  const limit = 50;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  
  while (true) {
    const url = `https://developer.nps.gov/api/v1/parks?limit=${limit}&start=${start}&fields=images&api_key=${API_KEY}`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`API error: ${res.status}`);
        break;
      }
      
      const data = await res.json();
      const parks = data.data;
      
      if (!parks || parks.length === 0) break;
      
      for (const park of parks) {
        totalProcessed++;
        
        const lat = parseFloat(park.latitude);
        const lng = parseFloat(park.longitude);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;
        
        const extId = `nps-${park.parkCode}`;
        if (existingIds.has(extId)) continue;
        
        // Skip if name already exists (from Wikidata)
        if (nameSet.has(park.fullName.toLowerCase())) continue;
        
        // Get best image
        let imageUrl = '';
        if (park.images && park.images.length > 0) {
          imageUrl = park.images[0].url || '';
        }
        
        const category = guessCategory(park.designation || '', park.topics || []);
        const description = park.description || `${park.designation} in ${park.states}`;
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(park.fullName.replace(/ /g, '_'))}`;
        
        try {
          await sql`INSERT INTO hg_sites (
            external_id, name, lat, lng, category, era, short_description,
            wiki_url, image_url, country, significance, source_id, source_ref, geog
          ) VALUES (
            ${extId}, ${park.fullName}, ${lat}, ${lng},
            ${category}, ${park.designation || 'National Park Service'},
            ${description.substring(0, 500)},
            ${wikiUrl}, ${imageUrl}, ${'United States'}, ${4}, ${sourceId},
            ${park.url || ''},
            ${`SRID=4326;POINT(${lng} ${lat})`}
          )`;
          totalInserted++;
        } catch (e) {
          totalSkipped++;
        }
      }
      
      console.log(`Batch ${start}-${start + parks.length}: processed ${parks.length}, total inserted: ${totalInserted}`);
      
      start += limit;
      if (start >= parseInt(data.total)) break;
      
      await sleep(1000); // Be nice to the API
      
    } catch (e) {
      console.log(`Error: ${e.message}`);
      break;
    }
  }
  
  console.log(`\n✅ Processed ${totalProcessed} parks`);
  console.log(`Inserted: ${totalInserted} | Skipped: ${totalSkipped}`);
  
  const usTotal = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'United States'`;
  const usImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'United States' AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`USA total: ${usTotal[0].total} sites (${usImg[0].total} with images)`);
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Grand total: ${grand[0].total}`);
}

run().catch(e => console.error(e));
