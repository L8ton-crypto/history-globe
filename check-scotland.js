const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  const scotland = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'Scotland'`;
  const scotImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'Scotland' AND image_url IS NOT NULL AND image_url != ''`;
  console.log('Scotland sites:', scotland[0].total);
  console.log('Scotland with images:', scotImg[0].total);
  
  // Sample what we have
  const samples = await sql`SELECT name, category, source_id, significance FROM hg_sites WHERE country = 'Scotland' ORDER BY significance DESC, name LIMIT 20`;
  console.log('\nExisting Scotland sites:');
  samples.forEach(s => console.log(`  ${s.name} (${s.category}, src:${s.source_id}, sig:${s.significance})`));
  
  // Check bbox for anything geo-tagged as Scotland
  const bbox = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 54.7 AND 61 AND lng BETWEEN -8 AND -0.7`;
  console.log('\nSites in Scotland bbox:', bbox[0].total);
}
run();
