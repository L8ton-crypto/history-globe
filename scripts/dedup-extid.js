const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  console.log('=== Dedup by external_id (keep lowest id) ===\n');

  // Find all dupes and delete in one SQL statement - keeps the row with the lowest id
  const dupes = await sql`
    SELECT id FROM hg_sites 
    WHERE external_id IS NOT NULL
    AND id NOT IN (
      SELECT MIN(id) FROM hg_sites 
      WHERE external_id IS NOT NULL 
      GROUP BY external_id
    )
    AND external_id IN (
      SELECT external_id FROM hg_sites 
      WHERE external_id IS NOT NULL 
      GROUP BY external_id 
      HAVING COUNT(*) > 1
    )`;
  
  console.log(`Found ${dupes.length} duplicate rows to delete`);
  
  if (dupes.length === 0) { console.log('Nothing to do.'); return; }

  // Delete in batches of 500
  const ids = dupes.map(d => d.id);
  let deleted = 0;
  
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const result = await sql`DELETE FROM hg_sites WHERE id = ANY(${batch})`;
    deleted += batch.length;
    console.log(`  Deleted batch: ${deleted}/${ids.length}`);
  }

  console.log(`\n✅ Deleted ${deleted} duplicate rows`);
  
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  const egypt = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE country = 'Egypt'`;
  console.log(`Egypt: ${egypt[0].c} | Grand total: ${total[0].c}`);
}
run().catch(console.error);
