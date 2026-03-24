'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { HistoricalSite } from '@/data/sites';

interface SiteDetail {
  id: string;
  dbId: number;
  name: string;
  lat: number;
  lng: number;
  category: string;
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

// Cache for site details fetched from API
const detailCache = new Map<number, HistoricalSite>();

export function useStaticSites() {
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalAll, setTotalAll] = useState(0);

  // Load static GeoJSON once on mount
  useEffect(() => {
    let cancelled = false;
    
    fetch('/sites.geojson')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setGeojson(data);
        setTotalAll(data.features?.length || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load static sites:', err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Fetch full details for a site (on click)
  const fetchSiteDetail = useCallback(async (dbId: number): Promise<HistoricalSite | null> => {
    // Check cache first
    if (detailCache.has(dbId)) {
      return detailCache.get(dbId)!;
    }

    try {
      const res = await fetch(`/api/sites/${dbId}`);
      if (!res.ok) return null;
      
      const data: SiteDetail = await res.json();
      
      const site: HistoricalSite = {
        id: data.id,
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        category: data.category as HistoricalSite['category'],
        era: data.era,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        imageUrl: data.imageUrl,
        wikiUrl: data.wikiUrl,
        country: data.country,
        region: data.region,
        unesco: data.unesco,
        significance: data.significance,
      };

      detailCache.set(dbId, site);
      return site;
    } catch (err) {
      console.error('Failed to fetch site detail:', err);
      return null;
    }
  }, []);

  return { geojson, loading, totalAll, fetchSiteDetail };
}
