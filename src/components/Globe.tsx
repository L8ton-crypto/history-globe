'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { HistoricalSite } from '@/data/sites';

const GlobeGL = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-white/70 text-sm">Loading globe...</div>
    </div>
  ),
});

interface GlobeComponentProps {
  sites: HistoricalSite[];
  onSiteClick: (site: HistoricalSite) => void;
  pointOfView?: {
    lat: number;
    lng: number;
    altitude: number;
  };
}

const categoryColors: Record<HistoricalSite['category'], string> = {
  roman: '#DC2626',
  medieval: '#2563EB',
  ancient: '#D97706',
  natural: '#16A34A',
  cultural: '#9333EA',
  industrial: '#F97316',
  religious: '#EC4899'
};

export default function GlobeComponent({ sites, onSiteClick, pointOfView }: GlobeComponentProps) {
  const globeRef = useRef<any>(null);
  const onSiteClickRef = useRef(onSiteClick);

  // Keep callback ref current without re-creating elements
  useEffect(() => {
    onSiteClickRef.current = onSiteClick;
  }, [onSiteClick]);

  useEffect(() => {
    if (globeRef.current && pointOfView) {
      globeRef.current.pointOfView(pointOfView, 1000);
    }
  }, [pointOfView]);

  // Create HTML pin element - fixed screen size regardless of zoom
  const createPinElement = useCallback((d: object) => {
    const site = d as HistoricalSite;
    const color = categoryColors[site.category];
    const size = 6 + site.significance * 2; // 8-16px

    const el = document.createElement('div');
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.backgroundColor = color;
    el.style.border = '1.5px solid rgba(255,255,255,0.7)';
    el.style.boxShadow = `0 0 ${size}px ${color}80, 0 0 ${size * 2}px ${color}30`;
    el.style.cursor = 'pointer';
    el.style.transition = 'transform 0.2s, box-shadow 0.2s';
    el.style.pointerEvents = 'auto';

    // Hover effect
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.6)';
      el.style.boxShadow = `0 0 ${size * 2}px ${color}, 0 0 ${size * 3}px ${color}80`;
      el.style.zIndex = '10';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
      el.style.boxShadow = `0 0 ${size}px ${color}80, 0 0 ${size * 2}px ${color}30`;
      el.style.zIndex = '0';
    });

    // Click handler
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSiteClickRef.current(site);
    });

    // Touch handler for mobile
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSiteClickRef.current(site);
    });

    return el;
  }, []);

  return (
    <GlobeGL
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

      atmosphereColor="#3a82f7"
      atmosphereAltitude={0.15}

      enablePointerInteraction={true}

      htmlElementsData={sites}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.01}
      htmlElement={createPinElement}
      htmlTransitionDuration={0}
    />
  );
}
