const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  // How many have weak/generic descriptions?
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  
  const generic = await sql`
    SELECT COUNT(*) as c FROM hg_sites 
    WHERE short_description LIKE 'Historical site in %' 
       OR short_description IS NULL 
       OR short_description = ''`;
  
  const hasWiki = await sql`
    SELECT COUNT(*) as c FROM hg_sites 
    WHERE wiki_url IS NOT NULL AND wiki_url != '' 
    AND (short_description LIKE 'Historical site in %' OR short_description IS NULL OR short_description = '')`;

  const good = await sql`
    SELECT COUNT(*) as c FROM hg_sites 
    WHERE short_description IS NOT NULL 
    AND short_description != '' 
    AND short_description NOT LIKE 'Historical site in %'`;

  console.log(`Total sites: ${total[0].c}`);
  console.log(`Good descriptions: ${good[0].c}`);
  console.log(`Weak/generic descriptions: ${generic[0].c}`);
  console.log(`Weak BUT have wiki_url (enrichable): ${hasWiki[0].c}`);
  
  // Breakdown by country
  const byCountry = await sql`
    SELECT country, 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE short_description LIKE 'Historical site in %' OR short_description IS NULL OR short_description = '') as weak
    FROM hg_sites
    GROUP BY country
    HAVING COUNT(*) > 100
    ORDER BY weak DESC
    LIMIT 20`;
  
  console.log('\nCountries with most weak descriptions:');
  for (const r of byCountry) {
    const pct = ((r.weak / r.total) * 100).toFixed(0);
    console.log(`  ${r.country}: ${r.weak}/${r.total} weak (${pct}%)`);
  }

  // Sample a weak one with wiki_url
  const sample = await sql`
    SELECT name, country, wiki_url, short_description 
    FROM hg_sites 
    WHERE wiki_url LIKE 'https://en.wikipedia%' 
    AND (short_description LIKE 'Historical site in %' OR short_description = '')
    LIMIT 5`;
  console.log('\nSample enrichable sites:');
  for (const s of sample) {
    console.log(`  "${s.name}" (${s.country}) → ${s.wiki_url}`);
  }
}
run().catch(console.error);
