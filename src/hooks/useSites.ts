'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { HistoricalSite } from '@/data/sites';

interface UseSitesOptions {
  category?: string;
  search?: string;
}

interface Bounds {
  south: number;
  north: number;
  west: number;
  east: number;
  zoom: number;
}

export function useSites(bounds: Bounds | null, options: UseSitesOptions = {}) {
  const [sites, setSites] = useState<HistoricalSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchKey = useRef('');

  const fetchSites = useCallback(async (b: Bounds, opts: UseSitesOptions) => {
    // Build a cache key to avoid refetching the same view
    const key = `${b.south.toFixed(2)},${b.north.toFixed(2)},${b.west.toFixed(2)},${b.east.toFixed(2)},${b.zoom},${opts.category || ''},${opts.search || ''}`;
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        south: b.south.toString(),
        north: b.north.toString(),
        west: b.west.toString(),
        east: b.east.toString(),
        zoom: b.zoom.toString(),
      });

      if (opts.category) params.set('category', opts.category);
      if (opts.search) params.set('search', opts.search);

      const response = await fetch(`/api/sites?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setSites(data.sites);
      setTotal(data.total);
      setTotalAll(data.totalAll || data.total);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Failed to fetch sites:', e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bounds) return;
    
    // Debounce fetches slightly
    const timeout = setTimeout(() => {
      fetchSites(bounds, options);
    }, 150);

    return () => clearTimeout(timeout);
  }, [bounds, options.category, options.search, fetchSites]);

  return { sites, loading, total, totalAll };
}
