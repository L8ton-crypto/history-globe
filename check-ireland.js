const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  // Check Ireland coverage
  const ireland = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'Ireland'`;
  const irelandImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = 'Ireland' AND image_url IS NOT NULL AND image_url != ''`;
  console.log('Ireland sites:', ireland[0].total);
  console.log('Ireland with images:', irelandImg[0].total);

  // Check by rough bounding box (Ireland is roughly lat 51.4-55.4, lng -10.5 to -5.5)
  const bbox = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 51.4 AND 55.4 AND lng BETWEEN -10.5 AND -5.5`;
  console.log('Sites in Ireland bbox:', bbox[0].total);

  // Check all countries
  const countries = await sql`SELECT country, COUNT(*) as total FROM hg_sites GROUP BY country ORDER BY total DESC LIMIT 20`;
  console.log('\nSites by country:');
  countries.forEach(c => console.log(`  ${c.country || '(empty)'}: ${c.total}`));

  // Sample Ireland sites
  const samples = await sql`SELECT name, category, era FROM hg_sites WHERE country = 'Ireland' OR (lat BETWEEN 51.4 AND 55.4 AND lng BETWEEN -10.5 AND -5.5) LIMIT 20`;
  console.log('\nIreland samples:');
  samples.forEach(s => console.log(`  ${s.name} (${s.category}, ${s.era})`));
}

run();
