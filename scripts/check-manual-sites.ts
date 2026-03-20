import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Check if manual source has any sites
  const manual = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE source_id = (SELECT id FROM hg_sources WHERE name = 'manual')`;
  console.log('Manual sites in DB:', manual[0].c);

  // Check Caerleon specifically
  const caerleon = await sql`SELECT name, image_url, source_id FROM hg_sites WHERE name ILIKE '%caerleon%' OR name ILIKE '%isca%'`;
  console.log('\nCaerleon entries:');
  caerleon.forEach(s => console.log(`  ${s.name} | img: ${s.image_url ? 'YES' : 'NO'} | source: ${s.source_id}`));

  // Check Newport area
  const newport = await sql`SELECT name, image_url FROM hg_sites WHERE region = 'Newport' AND image_url != '' AND image_url IS NOT NULL`;
  console.log(`\nNewport sites WITH images: ${newport.length}`);
  newport.forEach(s => console.log(`  ${s.name}`));
}
main();
