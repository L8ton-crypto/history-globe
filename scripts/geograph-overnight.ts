/**
 * Overnight Geograph enrichment loop
 * Runs batches of 1000 until no more UK/Ireland sites need images
 * Handles Neon connection drops gracefully
 */
import { neon } from '@neondatabase/serverless';
const DB = 'postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function findGeographImage(lat: number, lng: number, name: string): Promise<{ url: string; attribution: string } | null> {
  try {
    const apiUrl = `https://api.geograph.org.uk/syndicator.php?key=geo_kSjuKEQR&location=${lat},${lng}&distance=0.5&format=JSON&perpage=5`;
    const resp = await fetch(apiUrl, { 
      headers: { 'User-Agent': 'HistoryGlobe/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.items || data.items.length === 0) return null;

    const nameLower = name.toLowerCase();
    let best = data.items[0];
    for (const item of data.items) {
      const title = (item.title || '').toLowerCase();
      const nameWords = nameLower.split(/[\s,]+/).filter(w => w.length > 3);
      if (nameWords.some(w => title.includes(w))) {
        best = item;
        break;
      }
    }

    if (!best.thumb) return null;
    const fullUrl = best.thumb.replace('_120x120', '_213x160');
    const author = best.author || 'Unknown';
    return { url: fullUrl, attribution: `© ${author} / Geograph (CC BY-SA 2.0)` };
  } catch {
    return null;
  }
}

async function runBatch(batchNum: number): Promise<{ found: number; checked: number }> {
  const sql = neon(DB);
  
  const sites = await sql`
    SELECT id, name, lat, lng, significance FROM hg_sites
    WHERE (image_url = '' OR image_url IS NULL)
      AND country IN ('Wales', 'England', 'Scotland', 'Northern Ireland', 'Ireland')
    ORDER BY significance DESC, name
    LIMIT 800
  `;

  if (sites.length === 0) return { found: 0, checked: 0 };

  console.log(`\n--- Batch ${batchNum}: ${sites.length} sites ---`);
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    try {
      const result = await findGeographImage(site.lat, site.lng, site.name);
      if (result) {
        const freshSql = neon(DB);
        await freshSql`UPDATE hg_sites SET image_url = ${result.url} WHERE id = ${site.id}`;
        found++;
      } else {
        notFound++;
      }
    } catch (e: any) {
      // Connection drop - pause and continue
      if (e.message?.includes('fetch') || e.message?.includes('connection')) {
        console.log(`  Connection issue at ${i}, pausing 10s...`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${sites.length} - Found: ${found} | Not found: ${notFound}`);
    }
    await new Promise(r => setTimeout(r, 350));
  }

  console.log(`  Batch ${batchNum} done: +${found} images`);
  return { found, checked: sites.length };
}

async function main() {
  console.log('=== Geograph Overnight Enrichment ===');
  console.log(`Started: ${new Date().toISOString()}\n`);

  let totalFound = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    try {
      const { found, checked } = await runBatch(batchNum);
      totalFound += found;

      if (checked === 0) {
        console.log('\n✅ No more UK/Ireland sites without images!');
        break;
      }

      if (found === 0) {
        console.log('\n⚠️ Batch found nothing - remaining sites likely have no nearby Geograph photos');
        break;
      }

      // Stats
      const sql = neon(DB);
      const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
      const withImg = await sql`SELECT COUNT(*) as c FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
      console.log(`  📊 Total images: ${withImg[0].c}/${total[0].c} (${Math.round(Number(withImg[0].c)/Number(total[0].c)*100)}%)`);

      // Pause between batches
      console.log('  Pausing 30s before next batch...');
      await new Promise(r => setTimeout(r, 30000));
    } catch (e: any) {
      console.log(`  Batch ${batchNum} error: ${e.message}. Retrying in 60s...`);
      await new Promise(r => setTimeout(r, 60000));
    }
  }

  console.log(`\n🏁 Finished: ${new Date().toISOString()}`);
  console.log(`   Total new images: ${totalFound}`);
}
main().catch(console.error);
