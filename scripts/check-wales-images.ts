import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales'`;
  const withImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND image_url != '' AND image_url IS NOT NULL`;
  const noImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Wales' AND (image_url = '' OR image_url IS NULL)`;
  
  console.log(`Wales total: ${total[0].c}`);
  console.log(`Wales with image: ${withImg[0].c}`);
  console.log(`Wales no image: ${noImg[0].c}`);

  // Check some known castles
  const castles = await sql`SELECT name, image_url FROM hg_sites WHERE country = 'Wales' AND name LIKE '%Castle%' AND significance >= 4 LIMIT 10`;
  console.log('\nWelsh castles (sig >= 4):');
  castles.forEach(c => console.log(`  ${c.name}: ${c.image_url ? c.image_url.substring(0, 60) + '...' : 'NO IMAGE'}`));

  // Check if the enrichment script wiped images
  const imgCache = await sql`SELECT COUNT(*) as c FROM hg_site_images WHERE image_url IS NOT NULL AND site_id IN (SELECT id FROM hg_sites WHERE country = 'Wales')`;
  console.log(`\nWales image cache entries with URL: ${imgCache[0].c}`);
  
  // Check if images got set to null by the Cadw description enrichment
  const recentlyUpdated = await sql`SELECT name, image_url, updated_at FROM hg_sites WHERE country = 'Wales' AND significance >= 4 ORDER BY updated_at DESC LIMIT 5`;
  console.log('\nRecently updated Welsh sites:');
  recentlyUpdated.forEach(s => console.log(`  ${s.name}: img=${s.image_url ? 'YES' : 'NO'} updated=${s.updated_at}`));
}
main().catch(console.error);
