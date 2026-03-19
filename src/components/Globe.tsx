'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { HistoricalSite } from '@/data/sites';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-white/70">Loading globe...</div>
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

// Category colors
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

  useEffect(() => {
    if (globeRef.current && pointOfView) {
      globeRef.current.pointOfView(pointOfView, 1000);
    }
  }, [pointOfView]);

  const handlePointClick = (point: any) => {
    const site = sites.find(s => s.id === point.id);
    if (site) {
      onSiteClick(site);
    }
  };

  return (
    <Globe
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      
      // Atmosphere
      atmosphereColor="#3a82f7"
      atmosphereAltitude={0.15}
      
      // Controls
      enablePointerInteraction={true}
      
      // Points data
      pointsData={sites}
      pointLat="lat"
      pointLng="lng"
      pointColor={(d: any) => categoryColors[(d as HistoricalSite).category]}
      pointRadius={(d: any) => Math.max(0.3, (d as HistoricalSite).significance * 0.1)}
      pointAltitude={0.01}
      
      // Interaction
      onPointClick={handlePointClick}
      pointLabel={(d: any) => {
        const site = d as HistoricalSite;
        return `
          <div class="bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg p-3 max-w-xs">
            <div class="text-white font-semibold text-sm">${site.name}</div>
            <div class="text-white/70 text-xs mt-1">${site.era}</div>
            <div class="text-white/70 text-xs">${site.country}, ${site.region}</div>
          </div>
        `;
      }}
    />
  );
}