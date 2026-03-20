const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function searchWikipedia(name) {
  // Title case the name for a better search
  const query = name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.query?.search?.length > 0) {
      const title = data.query.search[0].title;
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function run() {
  const rows = await sql`SELECT id, name, wiki_url FROM hg_sites WHERE wiki_url ~ '/wiki/[A-Z_]+$' ORDER BY id`;
  console.log(`Found ${rows.length} sites with all-caps wiki URLs`);
  
  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const newUrl = await searchWikipedia(row.name);
    
    if (newUrl) {
      await sql`UPDATE hg_sites SET wiki_url = ${newUrl} WHERE id = ${row.id}`;
      found++;
    } else {
      // Title-case fallback
      const titleCase = row.name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join('_');
      await sql`UPDATE hg_sites SET wiki_url = ${'https://en.wikipedia.org/wiki/' + titleCase} WHERE id = ${row.id}`;
      notFound++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`${i + 1}/${rows.length} - Found: ${found} | Fallback: ${notFound}`);
    }

    // Rate limit - 200ms between requests
    await sleep(200);
  }

  console.log(`\nDone! Found: ${found} | Fallback: ${notFound} | Errors: ${errors}`);
}

run();
