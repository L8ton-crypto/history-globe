const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const r = await sql`SELECT COUNT(*) as count FROM hg_sites WHERE country = 'Egypt'`;
  console.log('Egypt sites:', r[0].count);
  const total = await sql`SELECT COUNT(*) as count FROM hg_sites`;
  console.log('Total sites:', total[0].count);
}
main().catch(e => console.error(e));
