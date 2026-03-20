import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  const total = await sql`SELECT COUNT(*) as c FROM hg_site_images`;
  const withImage = await sql`SELECT COUNT(*) as c FROM hg_site_images WHERE image_url IS NOT NULL`;
  const noImage = await sql`SELECT COUNT(*) as c FROM hg_site_images WHERE image_url IS NULL`;
  const enrichedDesc = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE image_url != '' AND image_url IS NOT NULL`;
  
  console.log('Image cache stats:');
  console.log(`  Total processed: ${total[0].c}`);
  console.log(`  With image: ${withImage[0].c}`);
  console.log(`  No image: ${noImage[0].c}`);
  console.log(`  Sites with image_url set: ${enrichedDesc[0].c}`);
  
  // Sample some with images
  const samples = await sql`SELECT name, image_url FROM hg_sites WHERE image_url != '' AND image_url IS NOT NULL ORDER BY RANDOM() LIMIT 5`;
  console.log('\nSample sites with images:');
  samples.forEach(s => console.log(`  ${s.name}: ${s.image_url?.substring(0, 80)}...`));
}
check().catch(console.error);
