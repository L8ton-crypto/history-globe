/**
 * Database setup for HistoryGlobe
 * Creates tables and indexes for scalable site storage
 * Run: npx tsx scripts/setup-db.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

async function setup() {
  console.log('Setting up HistoryGlobe database...\n');

  // Enable PostGIS if available (Neon supports it)
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
    console.log('✅ PostGIS extension enabled');
  } catch (e: any) {
    console.log('⚠️ PostGIS not available, using lat/lng columns with indexes instead');
  }

  // Sources table - tracks where data came from
  await sql`
    CREATE TABLE IF NOT EXISTS hg_sources (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      display_name VARCHAR(200),
      url VARCHAR(500),
      last_imported_at TIMESTAMPTZ,
      site_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ hg_sources table created');

  // Main sites table
  await sql`
    CREATE TABLE IF NOT EXISTS hg_sites (
      id SERIAL PRIMARY KEY,
      external_id VARCHAR(200),
      name VARCHAR(500) NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'cultural',
      era VARCHAR(200),
      short_description TEXT,
      long_description TEXT,
      wiki_url VARCHAR(500),
      image_url VARCHAR(500),
      country VARCHAR(100),
      region VARCHAR(200),
      unesco BOOLEAN DEFAULT FALSE,
      significance SMALLINT DEFAULT 3,
      source_id INTEGER REFERENCES hg_sources(id),
      source_ref VARCHAR(200),
      site_type VARCHAR(200),
      period VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      CONSTRAINT valid_lat CHECK (lat >= -90 AND lat <= 90),
      CONSTRAINT valid_lng CHECK (lng >= -180 AND lng <= 180),
      CONSTRAINT valid_significance CHECK (significance >= 1 AND significance <= 5),
      CONSTRAINT valid_category CHECK (category IN ('roman', 'medieval', 'ancient', 'natural', 'cultural', 'industrial', 'religious'))
    )
  `;
  console.log('✅ hg_sites table created');

  // Spatial index on lat/lng for bounding box queries
  await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_lat_lng ON hg_sites (lat, lng)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_category ON hg_sites (category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_country ON hg_sites (country)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_source ON hg_sites (source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_significance ON hg_sites (significance)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_name ON hg_sites USING gin (to_tsvector('english', name))`;
  console.log('✅ Indexes created');

  // Try to add PostGIS geography column
  try {
    await sql`ALTER TABLE hg_sites ADD COLUMN IF NOT EXISTS geog GEOGRAPHY(POINT, 4326)`;
    // Populate geography from lat/lng
    await sql`UPDATE hg_sites SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography WHERE geog IS NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hg_sites_geog ON hg_sites USING GIST (geog)`;
    console.log('✅ PostGIS geography column and spatial index created');
  } catch (e: any) {
    console.log('⚠️ PostGIS geography column skipped (using lat/lng indexes)');
  }

  // Cached images table
  await sql`
    CREATE TABLE IF NOT EXISTS hg_site_images (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES hg_sites(id) ON DELETE CASCADE,
      image_url VARCHAR(1000),
      thumbnail_url VARCHAR(1000),
      attribution TEXT,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(site_id)
    )
  `;
  console.log('✅ hg_site_images table created');

  // Insert default sources
  await sql`
    INSERT INTO hg_sources (name, display_name, url) VALUES
      ('manual', 'Hand-curated', NULL),
      ('cadw', 'Cadw (Welsh Government)', 'https://cadw.gov.wales'),
      ('unesco', 'UNESCO World Heritage', 'https://whc.unesco.org'),
      ('english_heritage', 'English Heritage', 'https://www.english-heritage.org.uk'),
      ('historic_england', 'Historic England', 'https://historicengland.org.uk'),
      ('national_trust', 'National Trust', 'https://www.nationaltrust.org.uk'),
      ('historic_scotland', 'Historic Environment Scotland', 'https://www.historicenvironment.scot')
    ON CONFLICT (name) DO NOTHING
  `;
  console.log('✅ Default sources inserted');

  // Count check
  const countResult = await sql`SELECT COUNT(*) as count FROM hg_sites`;
  console.log(`\n📊 Current site count: ${countResult[0].count}`);

  const sourceResult = await sql`SELECT name, site_count FROM hg_sources ORDER BY name`;
  console.log('📊 Sources:', sourceResult.map(s => `${s.name}: ${s.site_count}`).join(', '));

  console.log('\n✅ Database setup complete!');
}

setup().catch(console.error);
