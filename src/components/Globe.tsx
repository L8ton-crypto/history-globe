'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { HistoricalSite } from '@/data/sites';

interface GlobeComponentProps {
  geojson: GeoJSON.FeatureCollection | null;
  activeCategories: Set<HistoricalSite['category']>;
  onSiteClick: (dbId: number) => void;
  pointOfView?: {
    lat: number;
    lng: number;
    altitude: number;
  };
}

function altitudeToZoom(altitude: number): number {
  return Math.max(1, Math.min(18, 10 - Math.log2(altitude * 5)));
}

export default function GlobeComponent({ geojson, activeCategories, onSiteClick, pointOfView }: GlobeComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const onSiteClickRef = useRef(onSiteClick);
  const sourceReady = useRef(false);

  useEffect(() => { onSiteClickRef.current = onSiteClick; }, [onSiteClick]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-3, 52],
      zoom: 4,
      projection: 'globe',
      attributionControl: false,
    });

    m.on('style.load', () => {
      m.setFog({
        color: 'rgb(10, 10, 30)',
        'high-color': 'rgb(20, 20, 60)',
        'horizon-blend': 0.08,
        'space-color': 'rgb(5, 5, 15)',
        'star-intensity': 0.6,
      });
    });

    m.on('load', () => {
      // GeoJSON source with clustering - data set later
      m.addSource('sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster circles
      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'sites',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#6366f1', 10, '#8b5cf6', 25, '#a855f7', 50, '#c026d3',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            18, 10, 22, 25, 28, 50, 34,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.8)',
        }
      });

      m.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'sites',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' }
      });

      // Individual pins
      m.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'sites',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'significance'],
            1, 5, 3, 7, 5, 10,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.8)',
        }
      });

      // Click: clusters zoom in
      m.on('click', 'clusters', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = m.getSource('sites') as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const geometry = features[0].geometry;
          if (geometry.type === 'Point') {
            m.easeTo({ center: geometry.coordinates as [number, number], zoom: zoom ?? undefined });
          }
        });
      });

      // Click: individual pin -> fetch details
      m.on('click', 'unclustered-point', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
        if (!features.length) return;
        const dbId = features[0].properties?.dbId;
        if (dbId) onSiteClickRef.current(dbId);
      });

      // Cursors
      m.on('mouseenter', 'clusters', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'clusters', () => { m.getCanvas().style.cursor = ''; });
      m.on('mouseenter', 'unclustered-point', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'unclustered-point', () => { m.getCanvas().style.cursor = ''; });

      // Hover tooltip
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: 'site-popup', offset: 12 });
      m.on('mouseenter', 'unclustered-point', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
        if (!features.length) return;
        const geometry = features[0].geometry;
        if (geometry.type === 'Point') {
          popup.setLngLat(geometry.coordinates as [number, number])
            .setHTML(`<div style="font-weight:600;font-size:13px;">${features[0].properties?.name || ''}</div>`)
            .addTo(m);
        }
      });
      m.on('mouseleave', 'unclustered-point', () => { popup.remove(); });

      sourceReady.current = true;
    });

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.current = m;
    return () => { m.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON data when geojson or category filters change
  useEffect(() => {
    const m = map.current;
    if (!m || !sourceReady.current || !geojson) return;

    const source = m.getSource('sites') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    // Filter by active categories client-side
    const filtered: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: geojson.features.filter(f => 
        activeCategories.has(f.properties?.category as HistoricalSite['category'])
      )
    };

    source.setData(filtered);
  }, [geojson, activeCategories]);

  // Fly to point of view
  useEffect(() => {
    if (!map.current || !pointOfView) return;
    map.current.flyTo({
      center: [pointOfView.lng, pointOfView.lat],
      zoom: altitudeToZoom(pointOfView.altitude),
      duration: 1500,
    });
  }, [pointOfView]);

  return (
    <>
      <div ref={mapContainer} className="w-full h-full" />
      <style jsx global>{`
        .mapboxgl-popup-content {
          background: rgba(0, 0, 0, 0.85) !important;
          color: white !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          backdrop-filter: blur(10px) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
        .mapboxgl-popup-tip { border-top-color: rgba(0, 0, 0, 0.85) !important; }
        .mapboxgl-ctrl-attrib { display: none !important; }
      `}</style>
    </>
  );
}
