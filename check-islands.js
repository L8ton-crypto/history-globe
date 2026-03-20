const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
async function run() {
  // Isle of Man (~54.2, -4.5)
  const iom = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 54.0 AND 54.5 AND lng BETWEEN -5.0 AND -4.0`;
  console.log('Isle of Man area:', iom[0].total);
  
  // Channel Islands (Jersey ~49.2, -2.1 / Guernsey ~49.45, -2.54)
  const ci = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 49.0 AND 49.8 AND lng BETWEEN -3.0 AND -1.8`;
  console.log('Channel Islands area:', ci[0].total);
  
  // Isle of Wight (~50.68, -1.3)
  const iow = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 50.55 AND 50.8 AND lng BETWEEN -1.6 AND -1.0`;
  console.log('Isle of Wight area:', iow[0].total);
  
  // Orkney (~59.0, -3.0)
  const ork = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 58.5 AND 59.5 AND lng BETWEEN -3.5 AND -2.5`;
  console.log('Orkney area:', ork[0].total);
  
  // Shetland (~60.4, -1.2)
  const shet = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 59.8 AND 60.8 AND lng BETWEEN -2.0 AND -0.5`;
  console.log('Shetland area:', shet[0].total);
  
  // Hebrides (~57.5, -7.0)
  const heb = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 56.5 AND 58.5 AND lng BETWEEN -8.0 AND -5.5`;
  console.log('Hebrides area:', heb[0].total);
  
  // Anglesey (~53.25, -4.35)
  const ang = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE lat BETWEEN 53.1 AND 53.5 AND lng BETWEEN -4.8 AND -4.0`;
  console.log('Anglesey area:', ang[0].total);
}
run();
