const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  // First check columns
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'hg_sites' ORDER BY ordinal_position`;
  console.log('Columns:', cols.map(c => c.column_name).join(', '));
  
  const rows = await sql`SELECT * FROM hg_sites WHERE name ILIKE '%shirburn%'`;
  console.log('\nResults:', JSON.stringify(rows, null, 2));
}
run();
