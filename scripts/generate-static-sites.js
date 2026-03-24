/**
 * Generate static GeoJSON for client-side map rendering.
 * Only includes fields needed for pins (slim payload).
 * Full details fetched via API on click.
 * 
 * Run after any data import: node scripts/generate-static-sites.js
 */
const { neon } = require('@neondatabase/serverless');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const categoryColors = {
  roman: '#DC2626',
  medieval: '#2563EB',
  ancient: '#D97706',
  natural: '#16A34A',
  cultural: '#9333EA',
  industrial: '#F97316',
  religious: '#EC4899'
};

async function run() {
  console.log('Generating static sites GeoJSON...\n');

  // Fetch ALL sites but only the fields needed for map pins
  const sites = await sql`
    SELECT id, external_id, name, lat, lng, category, significance, country
    FROM hg_sites
    ORDER BY id
  `;

  console.log(`Fetched ${sites.length} sites from DB`);

  const geojson = {
    type: 'FeatureCollection',
    features: sites.map(s => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(s.lng), parseFloat(s.lat)]
      },
      properties: {
        id: s.external_id || `db-${s.id}`,
        dbId: s.id,
        name: s.name,
        category: s.category,
        significance: s.significance || 3,
        color: categoryColors[s.category] || '#9333EA',
        country: s.country || ''
      }
    }))
  };

  // Write to public directory so it's served statically
  const outPath = join(__dirname, '..', 'public', 'sites.geojson');
  writeFileSync(outPath, JSON.stringify(geojson));

  const sizeBytes = Buffer.byteLength(JSON.stringify(geojson));
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
  console.log(`\nWritten to: ${outPath}`);
  console.log(`Size: ${sizeMB} MB (raw JSON)`);
  console.log(`Estimated gzipped: ~${(sizeBytes * 0.15 / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Features: ${geojson.features.length}`);
  console.log('\nThis file is served at /sites.geojson');
  console.log('Vercel will gzip it automatically on serve.');
}

run().catch(e => console.error('FATAL:', e));
