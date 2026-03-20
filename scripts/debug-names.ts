import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const dbNames = await sql`SELECT name FROM hg_sites WHERE source_id = (SELECT id FROM hg_sources WHERE name='cadw') LIMIT 5`;
  console.log('DB names:');
  dbNames.forEach(r => console.log(`  [${r.name}] len=${r.name.length}`));

  // Compare with WFS
  const resp = await fetch('https://datamap.gov.wales/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=inspire-wg:Cadw_SAM&count=5&outputFormat=application/json&propertyName=RecordNumber,Name');
  const data = await resp.json();
  console.log('\nWFS names:');
  data.features.forEach((f: any) => {
    const name = f.properties.Name;
    console.log(`  [${name}] len=${name.length} trimmed=[${name.trim()}] trimLen=${name.trim().length}`);
  });
}
main();
