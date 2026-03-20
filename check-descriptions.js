const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  // How many have meaningful descriptions vs generic
  const total = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const noDesc = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE short_description IS NULL OR short_description = ''`;
  const generic = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE short_description LIKE 'Historical site%' OR short_description LIKE 'Historic site%'`;
  const gradeI = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE short_description LIKE 'Grade I%'`;
  const hasLong = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE long_description IS NOT NULL AND long_description != ''`;
  
  console.log('Total sites:', total[0].total);
  console.log('No description:', noDesc[0].total);
  console.log('Generic "Historical site...":', generic[0].total);
  console.log('Grade I boilerplate:', gradeI[0].total);
  console.log('Has long description:', hasLong[0].total);
  
  // Sample some good ones
  console.log('\n--- Good descriptions ---');
  const good = await sql`SELECT name, short_description FROM hg_sites WHERE LENGTH(short_description) > 50 AND short_description NOT LIKE 'Grade I%' AND short_description NOT LIKE 'Historical site%' LIMIT 5`;
  good.forEach(r => console.log(`${r.name}: ${r.short_description.substring(0, 100)}...`));
  
  // Sample some bad ones
  console.log('\n--- Generic descriptions ---');
  const bad = await sql`SELECT name, short_description FROM hg_sites WHERE short_description LIKE 'Historical site%' OR short_description LIKE 'Grade I%' LIMIT 5`;
  bad.forEach(r => console.log(`${r.name}: ${r.short_description}`));
  
  // NPS should have good ones
  console.log('\n--- NPS descriptions ---');
  const nps = await sql`SELECT name, short_description FROM hg_sites WHERE external_id LIKE 'nps-%' LIMIT 3`;
  nps.forEach(r => console.log(`${r.name}: ${r.short_description.substring(0, 120)}...`));
}
run();
