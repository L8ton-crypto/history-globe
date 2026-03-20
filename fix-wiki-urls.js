const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  // First fix Shirburn specifically
  await sql`UPDATE hg_sites SET wiki_url = 'https://en.wikipedia.org/wiki/Shirburn_Castle' WHERE id = 6199`;
  console.log('Fixed Shirburn Castle wiki_url');

  // Check how many have all-caps wiki URLs (pattern: /wiki/ALL_CAPS)
  const allCaps = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE wiki_url ~ '/wiki/[A-Z_]+$'`;
  console.log('Sites with ALL CAPS wiki URLs:', allCaps[0].total);

  // Sample some
  const samples = await sql`SELECT name, wiki_url FROM hg_sites WHERE wiki_url ~ '/wiki/[A-Z_]+$' LIMIT 10`;
  samples.forEach(s => console.log(`  ${s.name} → ${s.wiki_url}`));
}
run();
