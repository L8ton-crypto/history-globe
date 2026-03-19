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
  const pinElementsRef = useRef<Map<string, { el: HTMLElement; baseSize: number }>>(new Map());

  useEffect(() => {
    onSiteClickRef.current = onSiteClick;
  }, [onSiteClick]);

  useEffect(() => {
    if (globeRef.current && pointOfView) {
      globeRef.current.pointOfView(pointOfView, 1000);
    }
  }, [pointOfView]);

  // Listen to camera changes and scale pins based on altitude
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const checkControls = setInterval(() => {
      const controls = globe.controls?.();
      if (!controls) return;

      clearInterval(checkControls);

      const updatePinSizes = () => {
        const pov = globe.pointOfView?.();
        if (!pov) return;

        const altitude = pov.altitude;
        // Scale factor: at altitude 2.5 (full globe) = 1.0, at altitude 0.1 (very close) = 0.3
        const scale = Math.max(0.25, Math.min(1.2, altitude / 2.0));

        pinElementsRef.current.forEach(({ el, baseSize }) => {
          const scaledSize = Math.max(4, baseSize * scale);
          el.style.width = `${scaledSize}px`;
          el.style.height = `${scaledSize}px`;
        });
      };

      controls.addEventListener('change', updatePinSizes);

      // Initial sizing
      updatePinSizes();

      return () => {
        controls.removeEventListener('change', updatePinSizes);
      };
    }, 200);

    return () => clearInterval(checkControls);
  }, []);

  const createPinElement = useCallback((d: object) => {
    const site = d as HistoricalSite;
    const color = categoryColors[site.category];
    const baseSize = 6 + site.significance * 3; // 9-21px base

    const el = document.createElement('div');
    el.style.width = `${baseSize}px`;
    el.style.height = `${baseSize}px`;
    el.style.borderRadius = '50%';
    el.style.backgroundColor = color;
    el.style.border = '1.5px solid rgba(255,255,255,0.7)';
    el.style.boxShadow = `0 0 6px ${color}80, 0 0 12px ${color}30`;
    el.style.cursor = 'pointer';
    el.style.transition = 'width 0.15s, height 0.15s, transform 0.2s, box-shadow 0.2s';
    el.style.pointerEvents = 'auto';

    // Track for dynamic resizing
    pinElementsRef.current.set(site.id, { el, baseSize });

    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.6)';
      el.style.boxShadow = `0 0 12px ${color}, 0 0 24px ${color}80`;
      el.style.zIndex = '10';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
      el.style.boxShadow = `0 0 6px ${color}80, 0 0 12px ${color}30`;
      el.style.zIndex = '0';
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSiteClickRef.current(site);
    });

    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSiteClickRef.current(site);
    });

    return el;
  }, []);

  // Clean up tracked elements when sites change
  useEffect(() => {
    const siteIds = new Set(sites.map(s => s.id));
    pinElementsRef.current.forEach((_, id) => {
      if (!siteIds.has(id)) {
        pinElementsRef.current.delete(id);
      }
    });
  }, [sites]);

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
