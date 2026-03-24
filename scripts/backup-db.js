const { neon } = require('@neondatabase/serverless');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = join(__dirname, '..', 'backups');
  mkdirSync(backupDir, { recursive: true });

  console.log('Backing up hg_sites...');
  const sites = await sql`SELECT * FROM hg_sites ORDER BY id`;
  writeFileSync(join(backupDir, `hg_sites_${timestamp}.json`), JSON.stringify(sites, null, 2));
  console.log(`  ${sites.length} sites backed up`);

  console.log('Backing up hg_sources...');
  const sources = await sql`SELECT * FROM hg_sources ORDER BY id`;
  writeFileSync(join(backupDir, `hg_sources_${timestamp}.json`), JSON.stringify(sources, null, 2));
  console.log(`  ${sources.length} sources backed up`);

  console.log('Backing up hg_site_images...');
  const images = await sql`SELECT * FROM hg_site_images ORDER BY id`;
  writeFileSync(join(backupDir, `hg_site_images_${timestamp}.json`), JSON.stringify(images, null, 2));
  console.log(`  ${images.length} image records backed up`);

  console.log(`\nBackup complete: ${backupDir}`);
  
  // Country breakdown
  const breakdown = await sql`SELECT country, COUNT(*) as total FROM hg_sites GROUP BY country ORDER BY total DESC`;
  console.log('\nCountry breakdown:');
  for (const r of breakdown) {
    console.log(`  ${r.country}: ${r.total}`);
  }
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const grandImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\nGRAND TOTAL: ${grand[0].total} sites (${grandImg[0].total} with images)`);
}
main().catch(console.error);
