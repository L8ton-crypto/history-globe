import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function main() {
  const r = await sql`SELECT name, wiki_url FROM hg_sites WHERE name ILIKE '%kidwelly%' OR name ILIKE '%caernarfon%castle%' OR name ILIKE '%morlais%' OR name ILIKE '%weobley%'`;
  r.forEach(s => console.log(`${s.name} -> ${s.wiki_url}`));
}
main();
