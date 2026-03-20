import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Get all sites with image URLs
  const sites = await sql`
    SELECT id, name, image_url FROM hg_sites 
    WHERE image_url IS NOT NULL AND image_url != ''
    ORDER BY significance DESC
  `;

  console.log(`Sites with image URLs: ${sites.length}`);
  
  let ok = 0;
  let broken = 0;
  let errors = 0;
  const brokenList: string[] = [];

  // Check in batches of 10 concurrent
  const batchSize = 10;
  for (let i = 0; i < sites.length; i += batchSize) {
    const batch = sites.slice(i, i + batchSize);
    
    const results = await Promise.allSettled(
      batch.map(async (site) => {
        try {
          const resp = await fetch(site.image_url, { 
            method: 'HEAD', 
            redirect: 'follow',
            headers: { 'User-Agent': 'HistoryGlobe/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          return { id: site.id, name: site.name, status: resp.status, url: site.image_url };
        } catch (e: any) {
          return { id: site.id, name: site.name, status: 0, url: site.image_url, error: e.message };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'rejected') { errors++; continue; }
      const { status, name } = r.value;
      if (status === 200 || status === 301 || status === 302) {
        ok++;
      } else {
        broken++;
        if (broken <= 30) brokenList.push(`  ${name} -> ${status}`);
      }
    }

    if ((i + batchSize) % 100 === 0 || i + batchSize >= sites.length) {
      console.log(`  ${Math.min(i + batchSize, sites.length)}/${sites.length} - OK: ${ok} | Broken: ${broken} | Errors: ${errors}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n📊 Results:`);
  console.log(`   Total checked: ${sites.length}`);
  console.log(`   ✅ Working: ${ok} (${Math.round(ok/sites.length*100)}%)`);
  console.log(`   ❌ Broken (404/other): ${broken} (${Math.round(broken/sites.length*100)}%)`);
  console.log(`   ⚠️ Errors (timeout etc): ${errors}`);
  
  if (brokenList.length > 0) {
    console.log(`\nSample broken:`);
    brokenList.forEach(b => console.log(b));
  }
}
main().catch(console.error);
