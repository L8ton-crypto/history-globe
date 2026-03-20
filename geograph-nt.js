const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const rows = await sql`SELECT id, name, lat, lng FROM hg_sites 
    WHERE source_id = 6 AND (image_url IS NULL OR image_url = '') ORDER BY id`;
  console.log(`NT sites without images: ${rows.length}`);
  
  let found = 0, notFound = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const res = await fetch(`https://api.geograph.org.uk/syndicator.php?key=geo_kSjuKEQR&location=${r.lat},${r.lng}&distance=0.5&format=JSON`);
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) {
          const data = JSON.parse(text);
          if (data.items?.length > 0) {
            let img = data.items[0].thumb || data.items[0].image;
            if (img) { img = img.replace('_120x120', '_213x160'); }
            await sql`UPDATE hg_sites SET image_url = ${img} WHERE id = ${r.id}`;
            found++;
          } else notFound++;
        } else notFound++;
      } else notFound++;
    } catch { notFound++; }
    if ((i+1) % 25 === 0) console.log(`${i+1}/${rows.length} - Found: ${found} | Not found: ${notFound}`);
    await sleep(300);
  }
  console.log(`\n✅ Found: ${found} | Not found: ${notFound}`);
}
run();
