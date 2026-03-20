const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function searchWikipedia(name) {
  const query = name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json`;
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      console.log('  Rate limited, waiting 5s...');
      await sleep(5000);
      const res2 = await fetch(url);
      const data = await res2.json();
      if (data.query?.search?.length > 0) {
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(data.query.search[0].title.replace(/ /g, '_'))}`;
      }
      return null;
    }
    const data = await res.json();
    if (data.query?.search?.length > 0) {
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(data.query.search[0].title.replace(/ /g, '_'))}`;
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function run() {
  const rows = await sql`SELECT id, name, wiki_url FROM hg_sites WHERE wiki_url ~ '/wiki/[A-Z_]+$' ORDER BY id`;
  console.log(`Remaining: ${rows.length} sites`);
  
  let found = 0, fallback = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const newUrl = await searchWikipedia(row.name);
    
    if (newUrl) {
      await sql`UPDATE hg_sites SET wiki_url = ${newUrl} WHERE id = ${row.id}`;
      found++;
    } else {
      const titleCase = row.name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join('_');
      await sql`UPDATE hg_sites SET wiki_url = ${'https://en.wikipedia.org/wiki/' + titleCase} WHERE id = ${row.id}`;
      fallback++;
    }

    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${rows.length} - Found: ${found} | Fallback: ${fallback}`);
    await sleep(500); // slower to avoid rate limit
  }

  console.log(`\nDone! Found: ${found} | Fallback: ${fallback}`);
}

run();
