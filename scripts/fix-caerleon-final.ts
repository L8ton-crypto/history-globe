import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Fix amphitheatre with verified working image
  const amphiImg = 'https://commons.wikimedia.org/wiki/Special:FilePath/Caerleon%20Amphitheatre%20-%20geograph.org.uk%20-%206413429.jpg?width=330';
  await sql`UPDATE hg_sites SET image_url = ${amphiImg} WHERE name = 'Caerleon Roman Amphitheatre'`;
  await sql`UPDATE hg_site_images SET image_url = ${amphiImg}, thumbnail_url = ${amphiImg} WHERE site_id = (SELECT id FROM hg_sites WHERE name = 'Caerleon Roman Amphitheatre')`;
  console.log('✅ Amphitheatre fixed');

  // Fix baths - search for correct image  
  const bathsSearch = await fetch('https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=Caerleon+Roman+Baths&srnamespace=6&format=json&srlimit=1', { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
  const bathsData = await bathsSearch.json();
  if (bathsData.query?.search?.[0]) {
    const filename = bathsData.query.search[0].title.replace('File:', '');
    const bathsImg = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=330`;
    await sql`UPDATE hg_sites SET image_url = ${bathsImg} WHERE name = 'Caerleon Roman Baths'`;
    console.log(`✅ Baths fixed: ${filename}`);
  }

  // Fix Isca Augusta fortress
  const fortSearch = await fetch('https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=Caerleon+Roman+fortress+barracks&srnamespace=6&format=json&srlimit=1', { headers: { 'User-Agent': 'HistoryGlobe/1.0' } });
  const fortData = await fortSearch.json();
  if (fortData.query?.search?.[0]) {
    const filename = fortData.query.search[0].title.replace('File:', '');
    const fortImg = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=330`;
    await sql`UPDATE hg_sites SET image_url = ${fortImg} WHERE name = 'Isca Augusta (Caerleon Fortress)'`;
    console.log(`✅ Fortress fixed: ${filename}`);
  }

  // Verify all three
  const check = await sql`SELECT name, image_url FROM hg_sites WHERE name IN ('Caerleon Roman Amphitheatre', 'Caerleon Roman Baths', 'Isca Augusta (Caerleon Fortress)')`;
  console.log('\nVerification:');
  check.forEach(s => console.log(`  ${s.name}: ${s.image_url ? '✅' : '❌'} ${s.image_url?.substring(0, 80) || 'NONE'}`));
}
main().catch(console.error);
