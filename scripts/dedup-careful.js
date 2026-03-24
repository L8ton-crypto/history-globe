/**
 * CAREFUL dedup - finds duplicates and lists specific IDs to delete.
 * Phase 1: REPORT ONLY - writes delete list to JSON
 * Phase 2: Only deletes after review
 * 
 * Rules:
 * - Only deletes by specific row ID
 * - Keeps the "best" row (has image > has description > lowest ID)
 * - Logs every single deletion target
 * - Never uses broad WHERE clauses
 */
const { neon } = require('@neondatabase/serverless');
const { writeFileSync } = require('fs');
const { join } = require('path');

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

function pickKeeper(rows) {
  // Score each row: +10 for image, +5 for description, +1 for wiki_url, prefer lowest id as tiebreaker
  return rows.sort((a, b) => {
    const scoreA = (a.image_url ? 10 : 0) + (a.short_description && a.short_description !== `Historical site in ${a.country}` ? 5 : 0) + (a.wiki_url ? 1 : 0);
    const scoreB = (b.image_url ? 10 : 0) + (b.short_description && b.short_description !== `Historical site in ${b.country}` ? 5 : 0) + (b.wiki_url ? 1 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA; // higher score first
    return a.id - b.id; // lower id first (older = original)
  })[0];
}

async function run() {
  console.log(`=== Careful Dedup ${DRY_RUN ? '(DRY RUN)' : '⚠️  EXECUTING DELETES'} ===\n`);

  const toDelete = [];

  // --- 1. Duplicate external_ids ---
  console.log('1. Finding duplicate external_ids...');
  const dupeExtIds = await sql`
    SELECT external_id, COUNT(*) as c 
    FROM hg_sites 
    WHERE external_id IS NOT NULL 
    GROUP BY external_id 
    HAVING COUNT(*) > 1 
    ORDER BY c DESC`;
  
  console.log(`   Found ${dupeExtIds.length} groups of duplicate external_ids`);

  for (const group of dupeExtIds) {
    const rows = await sql`
      SELECT id, external_id, name, country, image_url, short_description, wiki_url 
      FROM hg_sites 
      WHERE external_id = ${group.external_id} 
      ORDER BY id`;
    
    const keeper = pickKeeper([...rows]);
    const deletes = rows.filter(r => r.id !== keeper.id);
    
    for (const d of deletes) {
      toDelete.push({
        id: d.id,
        reason: `duplicate external_id ${d.external_id}`,
        name: d.name,
        country: d.country,
        keeping: { id: keeper.id, name: keeper.name }
      });
    }
  }
  console.log(`   → ${toDelete.length} rows to delete from external_id dupes`);

  // --- 2. Exact same coordinates + same name ---
  console.log('\n2. Finding exact coordinate + name duplicates...');
  const beforeCount = toDelete.length;
  const alreadyDeleting = new Set(toDelete.map(d => d.id));

  const sameCoordName = await sql`
    SELECT name, lat, lng, country, COUNT(*) as c, array_agg(id ORDER BY id) as ids
    FROM hg_sites
    GROUP BY name, lat, lng, country
    HAVING COUNT(*) > 1
    ORDER BY c DESC`;
  
  console.log(`   Found ${sameCoordName.length} groups with same name+coords+country`);

  for (const group of sameCoordName) {
    const rows = await sql`
      SELECT id, external_id, name, country, lat, lng, image_url, short_description, wiki_url
      FROM hg_sites
      WHERE id = ANY(${group.ids})
      ORDER BY id`;
    
    // Skip any already marked for deletion
    const remaining = rows.filter(r => !alreadyDeleting.has(r.id));
    if (remaining.length <= 1) continue;

    const keeper = pickKeeper([...remaining]);
    const deletes = remaining.filter(r => r.id !== keeper.id);
    
    for (const d of deletes) {
      if (alreadyDeleting.has(d.id)) continue;
      alreadyDeleting.add(d.id);
      toDelete.push({
        id: d.id,
        reason: `same name+coords+country: "${d.name}" at (${d.lat}, ${d.lng})`,
        name: d.name,
        country: d.country,
        keeping: { id: keeper.id, name: keeper.name }
      });
    }
  }
  console.log(`   → ${toDelete.length - beforeCount} additional rows to delete`);

  // --- Summary ---
  console.log(`\n=== TOTAL: ${toDelete.length} rows to delete ===`);
  console.log(`(out of 53,242 total - ${(toDelete.length / 53242 * 100).toFixed(2)}%)\n`);

  // Write the full delete list to JSON for review
  const reportPath = join(__dirname, '..', 'backups', 'dedup-delete-list.json');
  writeFileSync(reportPath, JSON.stringify(toDelete, null, 2));
  console.log(`Delete list saved to: ${reportPath}`);

  // Show sample
  console.log('\nSample deletions:');
  for (const d of toDelete.slice(0, 20)) {
    console.log(`  DELETE id=${d.id} "${d.name}" (${d.country}) — ${d.reason} — keeping id=${d.keeping.id}`);
  }
  if (toDelete.length > 20) console.log(`  ... and ${toDelete.length - 20} more`);

  if (DRY_RUN) {
    console.log('\n🔒 DRY RUN - no deletions performed.');
    console.log('To execute: node scripts/dedup-careful.js --execute');
    return;
  }

  // --- Execute deletions one by one ---
  console.log('\n⚠️  Executing deletions...');
  let deleted = 0;
  let errors = 0;
  
  for (const d of toDelete) {
    try {
      const result = await sql`DELETE FROM hg_sites WHERE id = ${d.id}`;
      deleted++;
    } catch (e) {
      errors++;
      console.error(`  Error deleting id=${d.id}: ${e.message?.substring(0, 60)}`);
    }
    if ((deleted + errors) % 50 === 0) console.log(`  Progress: ${deleted + errors}/${toDelete.length}`);
  }

  console.log(`\n✅ Deleted: ${deleted} | Errors: ${errors}`);
  
  const total = await sql`SELECT COUNT(*) as c FROM hg_sites`;
  console.log(`New total: ${total[0].c} sites`);
}

run().catch(e => console.error('FATAL:', e));
