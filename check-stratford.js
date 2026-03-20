const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  // Check what we have near Stratford-upon-Avon (lat ~52.19, lng ~-1.71)
  const nearby = await sql`SELECT id, name, lat, lng, source_id, significance, category 
    FROM hg_sites 
    WHERE lat BETWEEN 52.15 AND 52.23 AND lng BETWEEN -1.75 AND -1.65
    ORDER BY name`;
  
  console.log(`Sites near Stratford-upon-Avon: ${nearby.length}`);
  nearby.forEach(r => console.log(`  ${r.name} (src:${r.source_id}, sig:${r.significance}, cat:${r.category})`));

  // Also search by name
  const byName = await sql`SELECT id, name, source_id, significance FROM hg_sites WHERE name ILIKE '%stratford%' OR name ILIKE '%shakespeare%' ORDER BY name`;
  console.log(`\nSites matching 'stratford' or 'shakespeare': ${byName.length}`);
  byName.forEach(r => console.log(`  ${r.name} (src:${r.source_id}, sig:${r.significance})`));
  
  // Check our sources
  const sources = await sql`SELECT id, name, display_name FROM hg_sources ORDER BY id`;
  console.log('\nSources:');
  sources.forEach(s => console.log(`  ${s.id}: ${s.name} (${s.display_name})`));
}
run();
