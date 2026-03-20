const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  // Keep Castell Rhaglan (id 2161, better coords, Cadw source)
  // Delete Raglan Castle duplicate (id 5828)
  // But first update Castell Rhaglan's wiki_url to the English one (more useful)
  await sql`UPDATE hg_sites SET wiki_url = 'https://en.wikipedia.org/wiki/Raglan_Castle' WHERE id = 2161`;
  await sql`DELETE FROM hg_sites WHERE id = 5828`;
  console.log('Merged: kept Castell Rhaglan (2161), deleted Raglan Castle (5828)');
  console.log('Updated wiki_url to English Wikipedia article');
  
  // Quick check for other potential Welsh/English dupes - sites within 50m of each other
  const dupes = await sql`
    SELECT a.id as id1, a.name as name1, a.source_id as src1,
           b.id as id2, b.name as name2, b.source_id as src2,
           ST_Distance(a.geog, b.geog) as dist_m
    FROM hg_sites a
    JOIN hg_sites b ON a.id < b.id
    WHERE ST_DWithin(a.geog, b.geog, 50)
    AND a.source_id != b.source_id
    ORDER BY dist_m
    LIMIT 30
  `;
  
  console.log('\nPotential duplicates (different sources, within 50m):');
  dupes.forEach(d => {
    console.log(`  ${d.name1} (src:${d.src1}) <-> ${d.name2} (src:${d.src2}) | ${Math.round(d.dist_m)}m`);
  });
}
run();
