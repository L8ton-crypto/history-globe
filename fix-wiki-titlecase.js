const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function run() {
  const rows = await sql`SELECT id, name, wiki_url FROM hg_sites WHERE wiki_url ~ '/wiki/[A-Z_]+$' ORDER BY id`;
  console.log(`Remaining: ${rows.length} sites to title-case`);
  
  // Small words that stay lowercase (unless first word)
  const small = new Set(['of', 'the', 'and', 'in', 'at', 'to', 'for', 'on', 'by', 'with', 'a', 'an']);
  
  for (const row of rows) {
    const words = row.name.split(/\s+/);
    const titleCase = words.map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      // Handle ST -> St, MC -> Mc
      if (lower === 'st') return 'St';
      if (lower.startsWith('mc')) return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join('_');
    
    const newUrl = `https://en.wikipedia.org/wiki/${titleCase}`;
    await sql`UPDATE hg_sites SET wiki_url = ${newUrl} WHERE id = ${row.id}`;
  }
  
  // Verify none left
  const check = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE wiki_url ~ '/wiki/[A-Z_]+$'`;
  console.log(`Done. Remaining all-caps URLs: ${check[0].total}`);
}

run();
