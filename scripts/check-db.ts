import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  const total = await sql`SELECT COUNT(*) as count FROM hg_sites`;
  console.log('Total sites:', total[0].count);
  
  const bySource = await sql`
    SELECT s.name, COUNT(h.id) as count 
    FROM hg_sites h 
    JOIN hg_sources s ON h.source_id = s.id 
    GROUP BY s.name ORDER BY count DESC
  `;
  console.log('By source:', bySource);
  
  const wales = await sql`
    SELECT COUNT(*) as count FROM hg_sites 
    WHERE lat BETWEEN 51.3 AND 53.5 AND lng BETWEEN -5.5 AND -2.5
  `;
  console.log('Wales sites:', wales[0].count);
}
check().catch(console.error);
