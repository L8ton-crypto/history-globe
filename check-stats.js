const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  const t = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const i = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  const pct = ((i[0].total / t[0].total) * 100).toFixed(1);
  console.log('Total sites:', t[0].total);
  console.log('With images:', i[0].total, `(${pct}%)`);
}
run();
