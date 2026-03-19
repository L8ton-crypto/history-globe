import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title');
  
  if (!title) {
    return NextResponse.json({ error: 'Missing title parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: {
          'User-Agent': 'HistoryGlobe/1.0 (https://history-globe-sigma.vercel.app)',
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Wikipedia API error' }, { status: response.status });
    }

    const data = await response.json();
    
    const imageUrl = data.thumbnail?.source || data.originalimage?.source || null;
    const extract = data.extract || null;
    
    return NextResponse.json({ 
      imageUrl,
      extract,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      }
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
