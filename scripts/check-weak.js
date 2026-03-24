const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  const remaining = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE short_description LIKE 'Historical site in %' OR short_description IS NULL OR short_description = ''`;
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  const good = total[0].c - remaining[0].c;
  console.log(`Total: ${total[0].c} | Good descriptions: ${good} (${(good/total[0].c*100).toFixed(1)}%) | Weak: ${remaining[0].c}`);
  
  const byCountry = await sql`SELECT country, COUNT(*) as c FROM hg_sites WHERE short_description LIKE 'Historical site in %' OR short_description IS NULL OR short_description = '' GROUP BY country ORDER BY c DESC LIMIT 10`;
  console.log('\nRemaining weak by country:');
  for (const r of byCountry) console.log(`  ${r.country}: ${r.c}`);
}
run().catch(console.error);
