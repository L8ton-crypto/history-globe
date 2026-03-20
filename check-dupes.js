const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  const rows = await sql`SELECT id, name, lat, lng, image_url, wiki_url, source_id, country, significance FROM hg_sites WHERE name ILIKE '%raglan%' OR name ILIKE '%rhaglan%' ORDER BY name`;
  rows.forEach(r => {
    console.log(`ID: ${r.id} | ${r.name}`);
    console.log(`  Lat/Lng: ${r.lat}, ${r.lng}`);
    console.log(`  Source: ${r.source_id} | Sig: ${r.significance}`);
    console.log(`  Wiki: ${r.wiki_url}`);
    console.log(`  Image: ${r.image_url?.substring(0, 80)}`);
    console.log();
  });
}
run();
