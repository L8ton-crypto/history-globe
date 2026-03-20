const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const GEOGRAPH_KEY = 'geo_kSjuKEQR';

async function searchGeograph(lat, lng) {
  const url = `https://api.geograph.org.uk/syndicator.php?key=${GEOGRAPH_KEY}&location=${lat},${lng}&distance=0.5&format=JSON`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    const data = JSON.parse(text);
    if (data.items && data.items.length > 0) {
      // Get the first image, convert thumb to medium
      let imgUrl = data.items[0].thumb || data.items[0].image;
      if (imgUrl) {
        imgUrl = imgUrl.replace('_120x120', '_213x160');
      }
      return imgUrl;
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function run() {
  // Get Ireland/NI sites without images
  const rows = await sql`SELECT id, name, lat, lng FROM hg_sites 
    WHERE country IN ('Ireland', 'Northern Ireland') 
    AND (image_url IS NULL OR image_url = '')
    ORDER BY id`;
  
  console.log(`=== Geograph Ireland Image Enrichment ===`);
  console.log(`Sites without images: ${rows.length}\n`);
  
  let found = 0, notFound = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const imgUrl = await searchGeograph(row.lat, row.lng);
    
    if (imgUrl) {
      await sql`UPDATE hg_sites SET image_url = ${imgUrl} WHERE id = ${row.id}`;
      found++;
    } else {
      notFound++;
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`${i + 1}/${rows.length} - Found: ${found} | Not found: ${notFound}`);
    }
    
    await sleep(300);
  }
  
  console.log(`\n✅ Done! Found: ${found} | Not found: ${notFound}`);
  
  const total = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland')`;
  const withImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country IN ('Ireland', 'Northern Ireland') AND image_url IS NOT NULL AND image_url != ''`;
  console.log(`Ireland/NI: ${total[0].total} sites (${withImg[0].total} with images, ${((withImg[0].total/total[0].total)*100).toFixed(1)}%)`);
}

run().catch(e => console.error(e));
