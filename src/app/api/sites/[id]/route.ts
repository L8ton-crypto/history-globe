import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Try by numeric DB id first, then by external_id
    const numId = parseInt(id);
    let sites: any[] = [];
    
    if (!isNaN(numId)) {
      sites = await getSql()`
        SELECT id, external_id, name, lat, lng, category, era,
               short_description, long_description, wiki_url, image_url,
               country, region, unesco, significance
        FROM hg_sites
        WHERE id = ${numId}
        LIMIT 1
      `;
    }

    if (!sites.length) {
      sites = await getSql()`
        SELECT id, external_id, name, lat, lng, category, era,
               short_description, long_description, wiki_url, image_url,
               country, region, unesco, significance
        FROM hg_sites
        WHERE external_id = ${id}
        LIMIT 1
      `;
    }

    if (!sites?.length) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const s = sites[0];
    return NextResponse.json({
      id: s.external_id || `db-${s.id}`,
      dbId: s.id,
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
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      }
    });
  } catch (error: any) {
    console.error('Site detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 });
  }
}
