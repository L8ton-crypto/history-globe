const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  const existing = await sql`SELECT external_id FROM hg_sites WHERE external_id LIKE 'nps-%'`;
  const existingIds = new Set(existing.map(r => r.external_id));
  const existingNames = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country = 'United States'`;
  const nameSet = new Set(existingNames.map(r => r.name));
  const sourceRows = await sql`SELECT id FROM hg_sources WHERE name = 'manual'`;
  const sourceId = sourceRows[0].id;
  
  const res = await fetch('https://developer.nps.gov/api/v1/parks?limit=50&start=450&fields=images&api_key=DEMO_KEY');
  const data = await res.json();
  let ins = 0;
  
  for (const p of data.data) {
    const lat = parseFloat(p.latitude), lng = parseFloat(p.longitude);
    if (!lat || !lng) continue;
    const extId = 'nps-' + p.parkCode;
    if (existingIds.has(extId) || nameSet.has(p.fullName.toLowerCase())) continue;
    let img = p.images?.[0]?.url || '';
    let cat = 'cultural';
    const d = (p.designation || '').toLowerCase();
    if (/national park(?!way)|preserve|seashore/.test(d)) cat = 'natural';
    else if (/fort/.test(d)) cat = 'medieval';
    
    try {
      await sql`INSERT INTO hg_sites (external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog)
        VALUES (${extId}, ${p.fullName}, ${lat}, ${lng}, ${cat}, ${p.designation || 'NPS'},
        ${(p.description || '').substring(0, 500)},
        ${'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.fullName.replace(/ /g, '_'))},
        ${img}, ${'United States'}, ${4}, ${sourceId}, ${p.url || ''},
        ${`SRID=4326;POINT(${lng} ${lat})`})`;
      ins++;
    } catch {}
  }
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Inserted: ${ins} | Grand total: ${grand[0].total}`);
}
run();
