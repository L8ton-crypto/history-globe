import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Force dynamic rendering - don't try to connect at build time
export const dynamic = 'force-dynamic';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  
  // Bounding box parameters
  const south = parseFloat(params.get('south') || '-90');
  const north = parseFloat(params.get('north') || '90');
  const west = parseFloat(params.get('west') || '-180');
  const east = parseFloat(params.get('east') || '180');
  const zoom = parseInt(params.get('zoom') || '3');
  const category = params.get('category'); // optional filter
  const search = params.get('search'); // optional text search
  const limit = Math.min(parseInt(params.get('limit') || '2000'), 5000);

  try {
    let sites;
    
    if (search && search.trim()) {
      // Text search mode
      sites = await getSql()`
        SELECT id, external_id, name, lat, lng, category, era,
               short_description, long_description, wiki_url, image_url,
               country, region, unesco, significance
        FROM hg_sites
        WHERE to_tsvector('english', name) @@ plainto_tsquery('english', ${search})
        ORDER BY significance DESC
        LIMIT ${limit}
      `;
    } else if (zoom < 4) {
      // Low zoom: return only high-significance sites worldwide
      sites = await getSql()`
        SELECT id, external_id, name, lat, lng, category, era,
               short_description, long_description, wiki_url, image_url,
               country, region, unesco, significance
        FROM hg_sites
        WHERE significance >= 4
        ${category ? getSql()`AND category = ${category}` : getSql()``}
        ORDER BY significance DESC
        LIMIT ${limit}
      `;
    } else if (zoom < 7) {
      // Medium zoom: significance >= 3
      sites = await getSql()`
        SELECT id, external_id, name, lat, lng, category, era,
               short_description, long_description, wiki_url, image_url,
               country, region, unesco, significance
        FROM hg_sites
        WHERE lat BETWEEN ${south} AND ${north}
          AND lng BETWEEN ${west} AND ${east}
          AND significance >= 3
        ${category ? getSql()`AND category = ${category}` : getSql()``}
        ORDER BY significance DESC
        LIMIT ${limit}
      `;
    } else {
      // High zoom: all sites in bounding box
      sites = await getSql()`
        SELECT id, external_id, name, lat, lng, category, era,
               short_description, long_description, wiki_url, image_url,
               country, region, unesco, significance
        FROM hg_sites
        WHERE lat BETWEEN ${south} AND ${north}
          AND lng BETWEEN ${west} AND ${east}
        ${category ? getSql()`AND category = ${category}` : getSql()``}
        ORDER BY significance DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({
      sites: sites.map(s => ({
        id: s.external_id || `db-${s.id}`,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        category: s.category,
        era: s.era || '',
        shortDescription: s.short_description || '',
        longDescription: s.long_description || '',
        imageUrl: s.image_url || '',
        wikiUrl: s.wiki_url || '',
        country: s.country || '',
        region: s.region || '',
        unesco: s.unesco || false,
        significance: s.significance || 3,
      })),
      total: sites.length,
      zoom,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      }
    });
  } catch (error: any) {
    console.error('Sites API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}
