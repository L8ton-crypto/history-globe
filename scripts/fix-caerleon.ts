import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Find all Caerleon entries
  const sites = await sql`SELECT id, name, image_url, wiki_url, short_description FROM hg_sites WHERE name ILIKE '%caerleon%' ORDER BY name`;
  console.log('Caerleon entries:');
  sites.forEach(s => console.log(`  [${s.id}] ${s.name} | img: ${s.image_url || 'NONE'} | wiki: ${s.wiki_url}`));

  // Fix the amphitheatre specifically
  const amphi = sites.find(s => s.name.toLowerCase().includes('amphitheatre'));
  if (amphi) {
    console.log(`\nFixing amphitheatre (id: ${amphi.id})...`);
    
    // The correct Wikipedia article and image
    const wikiUrl = 'https://en.wikipedia.org/wiki/Caerleon_Amphitheatre';
    const imageUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/Caerleon_amphitheatre.jpg?width=330';
    const shortDesc = 'The best-preserved Roman amphitheatre in Britain, built around 90 AD for the Second Augustan Legion at Isca Augusta. It could hold around 6,000 spectators.';
    const longDesc = 'The Roman amphitheatre at Caerleon is the best preserved in Britain. Built around 90 AD to serve the Second Augustan Legion (Legio II Augusta) stationed at Isca Augusta, the amphitheatre could hold around 6,000 spectators and was used for gladiatorial contests, military exercises, and public entertainments. Caerleon was one of only three permanent legionary fortresses in Roman Britain, alongside Chester (Deva Victrix) and York (Eboracum). The amphitheatre was excavated in 1926 by Sir Mortimer Wheeler.';

    await sql`
      UPDATE hg_sites SET 
        wiki_url = ${wikiUrl},
        image_url = ${imageUrl},
        short_description = ${shortDesc},
        long_description = ${longDesc},
        significance = 5
      WHERE id = ${amphi.id}
    `;
    
    await sql`
      INSERT INTO hg_site_images (site_id, image_url, thumbnail_url)
      VALUES (${amphi.id}, ${imageUrl}, ${imageUrl})
      ON CONFLICT (site_id) DO UPDATE SET image_url = ${imageUrl}, fetched_at = NOW()
    `;
    
    console.log('✅ Fixed!');
  }

  // Also fix the baths and fortress
  const baths = sites.find(s => s.name.toLowerCase().includes('bath'));
  if (baths) {
    const imageUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/Caerleon_Roman_Baths.jpg?width=330';
    await sql`UPDATE hg_sites SET image_url = ${imageUrl}, wiki_url = 'https://en.wikipedia.org/wiki/Caerleon#Roman_baths' WHERE id = ${baths.id}`;
    await sql`INSERT INTO hg_site_images (site_id, image_url, thumbnail_url) VALUES (${baths.id}, ${imageUrl}, ${imageUrl}) ON CONFLICT (site_id) DO UPDATE SET image_url = ${imageUrl}, fetched_at = NOW()`;
    console.log('✅ Fixed baths');
  }

  // Verify
  const check = await sql`SELECT name, image_url FROM hg_sites WHERE name ILIKE '%caerleon%' AND (name ILIKE '%amphi%' OR name ILIKE '%bath%' OR name ILIKE '%fortress%')`;
  console.log('\nVerification:');
  check.forEach(s => console.log(`  ${s.name}: ${s.image_url || 'NONE'}`));
}
main().catch(console.error);
