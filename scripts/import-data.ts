/**
 * HistoryGlobe Data Import Script
 * Pulls sites from Cadw (Wales) and UNESCO APIs
 * Run: npx tsx scripts/import-data.ts
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface ImportedSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'roman' | 'medieval' | 'ancient' | 'natural' | 'cultural' | 'industrial' | 'religious';
  era: string;
  shortDescription: string;
  longDescription: string;
  imageUrl: string;
  wikiUrl: string;
  country: string;
  region: string;
  unesco: boolean;
  significance: number;
}

// Convert British National Grid (EPSG:27700) to WGS84 lat/lng
// Using Helmert transformation (accurate to ~5m)
function bngToLatLng(easting: number, northing: number): { lat: number; lng: number } {
  const a = 6377563.396; // Airy 1830 semi-major axis
  const b = 6356256.909; // semi-minor axis
  const F0 = 0.9996012717;
  const lat0 = (49 * Math.PI) / 180;
  const lng0 = (-2 * Math.PI) / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);

  let lat = lat0;
  let M = 0;

  do {
    lat = ((northing - N0 - M) / (a * F0)) + lat;

    const Ma = (1 + n + (5/4) * n * n + (5/4) * n * n * n) * (lat - lat0);
    const Mb = (3 * n + 3 * n * n + (21/8) * n * n * n) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
    const Mc = ((15/8) * n * n + (15/8) * n * n * n) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
    const Md = (35/24) * n * n * n * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (northing - N0 - M >= 0.00001);

  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;
  const tanLat = Math.tan(lat);

  const VII = tanLat / (2 * rho * nu);
  const VIII = tanLat / (24 * rho * nu * nu * nu) * (5 + 3 * tanLat * tanLat + eta2 - 9 * tanLat * tanLat * eta2);
  const IX = tanLat / (720 * rho * Math.pow(nu, 5)) * (61 + 90 * tanLat * tanLat + 45 * Math.pow(tanLat, 4));
  const X = 1 / (cosLat * nu);
  const XI = 1 / (6 * cosLat * nu * nu * nu) * (nu / rho + 2 * tanLat * tanLat);
  const XII = 1 / (120 * cosLat * Math.pow(nu, 5)) * (5 + 28 * tanLat * tanLat + 24 * Math.pow(tanLat, 4));

  const dE = easting - E0;

  const latRad = lat - VII * dE * dE + VIII * Math.pow(dE, 4) - IX * Math.pow(dE, 6);
  const lngRad = lng0 + X * dE - XI * Math.pow(dE, 3) + XII * Math.pow(dE, 5);

  return {
    lat: Math.round((latRad * 180 / Math.PI) * 10000) / 10000,
    lng: Math.round((lngRad * 180 / Math.PI) * 10000) / 10000
  };
}

// Map Cadw periods to our categories
function cadwPeriodToCategory(period: string, siteType: string): ImportedSite['category'] {
  const p = period?.toLowerCase() || '';
  const t = siteType?.toLowerCase() || '';

  if (p.includes('roman') || t.includes('roman') || t.includes('fort') && p.includes('roman')) return 'roman';
  if (p.includes('prehistoric') || p.includes('bronze') || p.includes('iron age') || p.includes('neolithic')) return 'ancient';
  if (p.includes('medieval') || t.includes('castle') || t.includes('motte')) return 'medieval';
  if (p.includes('post-medieval') || p.includes('industrial') || t.includes('mill') || t.includes('mine') || t.includes('furnace')) return 'industrial';
  if (t.includes('church') || t.includes('chapel') || t.includes('abbey') || t.includes('priory') || t.includes('monastery') || t.includes('cross')) return 'religious';
  if (p.includes('modern') || p.includes('20th')) return 'cultural';
  if (t.includes('castle')) return 'medieval';

  return 'ancient'; // default for prehistoric/unknown
}

function cadwPeriodToEra(period: string): string {
  const p = period?.toLowerCase() || '';
  if (p.includes('roman')) return '43 AD - 410 AD';
  if (p.includes('prehistoric')) return 'Prehistoric';
  if (p.includes('medieval')) return 'Medieval';
  if (p.includes('post-medieval')) return 'Post-Medieval';
  if (p.includes('multi-period')) return 'Multiple Periods';
  if (p.includes('modern')) return 'Modern';
  return period?.trim() || 'Unknown';
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '');
}

// Significance based on site type
function cadwSignificance(siteType: string, broadClass: string): number {
  const t = siteType?.toLowerCase() || '';
  const b = broadClass?.toLowerCase() || '';
  if (t.includes('castle') || t.includes('amphitheatre') || t.includes('cathedral')) return 4;
  if (t.includes('abbey') || t.includes('priory') || t.includes('fort') || t.includes('palace')) return 3;
  if (t.includes('church') || t.includes('bridge') || t.includes('town')) return 3;
  if (b.includes('defence') || b.includes('domestic')) return 2;
  return 2;
}

async function importCadw(): Promise<ImportedSite[]> {
  console.log('Fetching Cadw scheduled monuments...');
  
  const sites: ImportedSite[] = [];
  const batchSize = 500;
  let startIndex = 0;
  let total = 0;
  
  do {
    const url = `https://datamap.gov.wales/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=inspire-wg:Cadw_SAM&startIndex=${startIndex}&count=${batchSize}&outputFormat=application/json`;
    
    console.log(`  Fetching batch at offset ${startIndex}...`);
    const response = await fetch(url);
    const data = await response.json();
    
    total = data.totalFeatures;
    
    for (const feature of data.features) {
      const props = feature.properties;
      const name = (props.Name || '').trim();
      const easting = props.easting;
      const northing = props.northing;
      
      if (!name || !easting || !northing) continue;
      
      const { lat, lng } = bngToLatLng(easting, northing);
      
      // Skip if coordinates are clearly wrong (outside Wales roughly)
      if (lat < 51.3 || lat > 53.5 || lng < -5.5 || lng > -2.5) continue;
      
      const id = `cadw-${slugify(name)}`;
      const siteType = (props.SiteType || '').trim();
      const period = (props.Period || '').trim();
      const broadClass = (props.BroadClass || '').trim();
      const ua = (props.UnitaryAuthority || '').trim();
      
      sites.push({
        id,
        name,
        lat,
        lng,
        category: cadwPeriodToCategory(period, siteType),
        era: cadwPeriodToEra(period),
        shortDescription: `A ${siteType.toLowerCase()} in ${ua}, Wales. Classified as ${broadClass.toLowerCase()}.`,
        longDescription: `${name} is a scheduled monument in ${ua}, Wales. It is a ${siteType.toLowerCase()} dating from the ${period.toLowerCase()} period. This site is legally protected as a Scheduled Ancient Monument by Cadw, the Welsh Government's historic environment service.`,
        imageUrl: '',
        wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        country: 'Wales',
        region: ua,
        unesco: false,
        significance: cadwSignificance(siteType, broadClass),
      });
    }
    
    startIndex += batchSize;
    console.log(`  Got ${sites.length} valid sites so far (of ${total} total)`);
    
    // Be nice to the API
    await new Promise(r => setTimeout(r, 500));
    
  } while (startIndex < total);
  
  console.log(`Cadw import complete: ${sites.length} sites`);
  return sites;
}

async function importUNESCO(): Promise<ImportedSite[]> {
  console.log('Fetching UNESCO World Heritage Sites...');
  
  const sites: ImportedSite[] = [];
  const batchSize = 100;
  let offset = 0;
  let total = 0;
  
  do {
    const url = `https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records?limit=${batchSize}&offset=${offset}&select=name_en,short_description_en,category,states_names,region,coordinates,date_inscribed,danger,criteria_txt`;
    
    console.log(`  Fetching UNESCO batch at offset ${offset}...`);
    const response = await fetch(url);
    const data = await response.json();
    
    total = data.total_count;
    
    for (const record of data.results) {
      const name = record.name_en;
      const coords = record.coordinates;
      
      if (!name || !coords || !coords.lat || !coords.lon) continue;
      
      const category_raw = (record.category || '').toLowerCase();
      let category: ImportedSite['category'] = 'cultural';
      if (category_raw === 'natural') category = 'natural';
      if (category_raw === 'mixed') category = 'natural';
      
      const country = (record.states_names || [])[0] || 'Unknown';
      const regionName = record.region || '';
      const description = record.short_description_en || '';
      const id = `unesco-${slugify(name)}`;
      
      sites.push({
        id,
        name,
        lat: Math.round(coords.lat * 10000) / 10000,
        lng: Math.round(coords.lon * 10000) / 10000,
        category,
        era: `Inscribed ${record.date_inscribed || 'unknown'}`,
        shortDescription: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
        longDescription: description,
        imageUrl: '',
        wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        country,
        region: regionName,
        unesco: true,
        significance: record.danger === 'True' ? 4 : 5,
      });
    }
    
    offset += batchSize;
    console.log(`  Got ${sites.length} valid UNESCO sites so far (of ${total} total)`);
    
    await new Promise(r => setTimeout(r, 300));
    
  } while (offset < total);
  
  console.log(`UNESCO import complete: ${sites.length} sites`);
  return sites;
}

async function main() {
  console.log('=== HistoryGlobe Data Import ===\n');
  
  // Import from both sources
  const [cadwSites, unescoSites] = await Promise.all([
    importCadw(),
    importUNESCO(),
  ]);
  
  // Load existing manual sites to avoid duplicates
  const existingPath = join(__dirname, '..', 'src', 'data', 'sites.ts');
  const existingContent = readFileSync(existingPath, 'utf-8');
  
  // Extract existing IDs
  const existingIds = new Set<string>();
  const idRegex = /id: '([^']+)'/g;
  let match;
  while ((match = idRegex.exec(existingContent)) !== null) {
    existingIds.add(match[1]);
  }
  
  console.log(`\nExisting manual sites: ${existingIds.size}`);
  
  // Deduplicate
  const allImported = [...cadwSites, ...unescoSites];
  const seenIds = new Set<string>();
  const dedupedImports: ImportedSite[] = [];
  
  for (const site of allImported) {
    if (existingIds.has(site.id) || seenIds.has(site.id)) continue;
    seenIds.add(site.id);
    dedupedImports.push(site);
  }
  
  console.log(`New sites to add: ${dedupedImports.length}`);
  console.log(`  Cadw: ${cadwSites.filter(s => !existingIds.has(s.id) && dedupedImports.includes(s)).length}`);
  console.log(`  UNESCO: ${unescoSites.filter(s => !existingIds.has(s.id) && dedupedImports.includes(s)).length}`);
  
  // Write imported sites to a separate file
  const importedPath = join(__dirname, '..', 'src', 'data', 'imported-sites.ts');
  
  const output = `// Auto-imported sites from Cadw and UNESCO APIs
// Generated: ${new Date().toISOString()}
// Total: ${dedupedImports.length} sites

import { HistoricalSite } from './sites';

export const importedSites: HistoricalSite[] = ${JSON.stringify(dedupedImports, null, 2)};
`;
  
  writeFileSync(importedPath, output);
  console.log(`\nWritten to: ${importedPath}`);
  console.log(`Total sites (manual + imported): ${existingIds.size + dedupedImports.length}`);
}

main().catch(console.error);
