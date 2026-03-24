const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  console.log('=== HistoryGlobe Data Sanity Check ===\n');

  // 1. Total counts
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  console.log(`Total sites: ${total[0].c}`);

  // 2. Duplicate names (same name, same country)
  const dupeNames = await sql`
    SELECT name, country, COUNT(*) as c 
    FROM hg_sites 
    GROUP BY name, country 
    HAVING COUNT(*) > 1 
    ORDER BY c DESC 
    LIMIT 20`;
  console.log(`\n--- Duplicate names (same country): ${dupeNames.length} groups ---`);
  for (const d of dupeNames.slice(0, 15)) {
    console.log(`  "${d.name}" (${d.country}): ${d.c} times`);
  }

  // 3. Sites very close together (within ~50m) - potential duplicates
  const closePairs = await sql`
    SELECT a.id as id1, a.name as name1, a.country as country1, 
           b.id as id2, b.name as name2, b.country as country2,
           a.lat as lat1, a.lng as lng1,
           ST_Distance(a.geog, b.geog) as dist_m
    FROM hg_sites a 
    JOIN hg_sites b ON a.id < b.id 
      AND ST_DWithin(a.geog, b.geog, 50)
    LIMIT 30`;
  console.log(`\n--- Sites within 50m of each other: ${closePairs.length} pairs ---`);
  for (const p of closePairs.slice(0, 15)) {
    console.log(`  "${p.name1}" (${p.country1}) ↔ "${p.name2}" (${p.country2}) [${Math.round(p.dist_m)}m apart]`);
  }

  // 4. Exact same coordinates
  const sameCoords = await sql`
    SELECT lat, lng, COUNT(*) as c, array_agg(name) as names
    FROM hg_sites
    GROUP BY lat, lng
    HAVING COUNT(*) > 1
    ORDER BY c DESC
    LIMIT 20`;
  console.log(`\n--- Exact same coordinates: ${sameCoords.length} groups ---`);
  for (const s of sameCoords.slice(0, 15)) {
    const nameList = s.names.slice(0, 4).join(', ');
    console.log(`  (${s.lat}, ${s.lng}): ${s.c} sites → ${nameList}${s.names.length > 4 ? '...' : ''}`);
  }

  // 5. Sites with no coordinates (shouldn't exist but check)
  const noCoords = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE lat IS NULL OR lng IS NULL`;
  console.log(`\nSites with NULL coords: ${noCoords[0].c}`);

  // 6. Sites outside expected bounds (lat -90..90, lng -180..180)
  const outOfBounds = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE lat < -90 OR lat > 90 OR lng < -180 OR lng > 180`;
  console.log(`Sites out of bounds: ${outOfBounds[0].c}`);

  // 7. Significance distribution
  const sigDist = await sql`SELECT significance, COUNT(*) as c FROM hg_sites GROUP BY significance ORDER BY significance`;
  console.log(`\nSignificance distribution:`);
  for (const s of sigDist) {
    console.log(`  ${s.significance}: ${s.c} sites`);
  }

  // 8. Sites with same external_id (Wikidata dupes)
  const dupeExtId = await sql`
    SELECT external_id, COUNT(*) as c 
    FROM hg_sites 
    WHERE external_id IS NOT NULL 
    GROUP BY external_id 
    HAVING COUNT(*) > 1 
    ORDER BY c DESC 
    LIMIT 20`;
  console.log(`\n--- Duplicate external_ids: ${dupeExtId.length} groups ---`);
  for (const d of dupeExtId.slice(0, 10)) {
    console.log(`  ${d.external_id}: ${d.c} times`);
  }

  // 9. Category distribution
  const catDist = await sql`SELECT category, COUNT(*) as c FROM hg_sites GROUP BY category ORDER BY c DESC`;
  console.log(`\nCategory distribution:`);
  for (const c of catDist) {
    console.log(`  ${c.category}: ${c.c}`);
  }

  // 10. API limit issue: check how many sites at zoom < 4 (sig >= 4) 
  const lowZoom = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE significance >= 4`;
  console.log(`\nSites visible at low zoom (sig >= 4): ${lowZoom[0].c}`);

  // 11. Medium zoom sig >= 3
  const medZoom = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE significance >= 3`;
  console.log(`Sites visible at medium zoom (sig >= 3): ${medZoom[0].c}`);
}

run().catch(e => console.error(e));
