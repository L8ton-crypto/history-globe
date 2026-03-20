const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
(async () => {
  const r = await sql`SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'hg_sites'::regclass AND contype = 'c'`;
  r.forEach(c => console.log(c.conname, ':', c.def));
  
  const cats = await sql`SELECT DISTINCT category FROM hg_sites ORDER BY category`;
  console.log('\nExisting categories:', cats.map(c => c.category));
})();
