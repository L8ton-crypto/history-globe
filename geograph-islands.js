const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  // Get all recently added island sites without images
  const rows = await sql`SELECT id, name, lat, lng, country FROM hg_sites 
    WHERE country IN ('Isle of Man', 'Jersey', 'Guernsey') 
    AND (image_url IS NULL OR image_url = '') ORDER BY id`;
  
  // Also Orkney/Shetland without images
  const scottishIsles = await sql`SELECT id, name, lat, lng, country FROM hg_sites 
    WHERE country = 'Scotland' 
    AND (image_url IS NULL OR image_url = '')
    AND (lat > 58.5 OR (lat > 56.5 AND lng < -5.5))
    ORDER BY id`;
  
  const allRows = [...rows, ...scottishIsles];
  console.log(`Island sites without images: ${allRows.length} (IoM/Jersey/Guernsey: ${rows.length}, Scottish isles: ${scottishIsles.length})`);
  
  let found = 0, notFound = 0;
  for (let i = 0; i < allRows.length; i++) {
    const r = allRows[i];
    try {
      const res = await fetch(`https://api.geograph.org.uk/syndicator.php?key=geo_kSjuKEQR&location=${r.lat},${r.lng}&distance=0.5&format=JSON`);
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) {
          const data = JSON.parse(text);
          if (data.items?.length > 0) {
            let img = data.items[0].thumb || data.items[0].image;
            if (img) img = img.replace('_120x120', '_213x160');
            await sql`UPDATE hg_sites SET image_url = ${img} WHERE id = ${r.id}`;
            found++;
          } else notFound++;
        } else notFound++;
      } else notFound++;
    } catch { notFound++; }
    if ((i+1) % 50 === 0) console.log(`${i+1}/${allRows.length} - Found: ${found} | Not found: ${notFound}`);
    await sleep(300);
  }
  console.log(`\n✅ Found: ${found} | Not found: ${notFound}`);
  
  // Stats
  for (const c of ['Isle of Man', 'Jersey', 'Guernsey']) {
    const t = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c}`;
    const img = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${c} AND image_url IS NOT NULL AND image_url != ''`;
    console.log(`${c}: ${t[0].total} sites, ${img[0].total} with images (${((img[0].total/t[0].total)*100).toFixed(0)}%)`);
  }
  
  const grand = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const grandImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\nGrand total: ${grand[0].total} sites, ${grandImg[0].total} with images (${((grandImg[0].total/grand[0].total)*100).toFixed(1)}%)`);
}
run();
