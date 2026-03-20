const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  const date = new Date().toISOString().split('T')[0];
  const dir = `backups`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  console.log(`=== Database Backup ${date} ===\n`);

  const sites = await sql`SELECT * FROM hg_sites ORDER BY id`;
  fs.writeFileSync(`${dir}/hg_sites_${date}.json`, JSON.stringify(sites, null, 2));
  console.log(`hg_sites: ${sites.length} rows`);

  const sources = await sql`SELECT * FROM hg_sources ORDER BY id`;
  fs.writeFileSync(`${dir}/hg_sources_${date}.json`, JSON.stringify(sources, null, 2));
  console.log(`hg_sources: ${sources.length} rows`);

  let images = [];
  try {
    images = await sql`SELECT * FROM hg_site_images ORDER BY id`;
    fs.writeFileSync(`${dir}/hg_site_images_${date}.json`, JSON.stringify(images, null, 2));
    console.log(`hg_site_images: ${images.length} rows`);
  } catch (e) {
    console.log('hg_site_images: table not found (skipped)');
  }

  // Summary stats
  const withImg = sites.filter(s => s.image_url && s.image_url !== '').length;
  const countries = {};
  sites.forEach(s => { countries[s.country || 'Unknown'] = (countries[s.country || 'Unknown'] || 0) + 1; });
  
  console.log(`\n📊 Summary:`);
  console.log(`Total sites: ${sites.length}`);
  console.log(`With images: ${withImg} (${((withImg/sites.length)*100).toFixed(1)}%)`);
  console.log(`\nBy country:`);
  Object.entries(countries).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  console.log(`\n✅ Backup saved to ${dir}/`);
}

run().catch(e => console.error(e));
