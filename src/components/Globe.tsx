'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Supercluster from 'supercluster';
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

interface ClusterOrSite {
  id: string;
  lat: number;
  lng: number;
  isCluster: boolean;
  count: number;
  site?: HistoricalSite;
  clusterId?: number;
  dominantCategory?: HistoricalSite['category'];
}

function altitudeToZoom(altitude: number): number {
  const zoom = Math.round(14 - Math.log2(altitude * 10));
  return Math.max(0, Math.min(20, zoom));
}

// Higher res earth textures from Solar System Scope (8k, free for non-commercial)
const EARTH_TEXTURE = 'https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg';
const EARTH_BUMP = 'https://unpkg.com/three-globe@2.41.12/example/img/earth-topology.png';
const NIGHT_SKY = 'https://unpkg.com/three-globe@2.41.12/example/img/night-sky.png';

export default function GlobeComponent({ sites, onSiteClick, pointOfView }: GlobeComponentProps) {
  const globeRef = useRef<any>(null);
  const onSiteClickRef = useRef(onSiteClick);
  const [currentZoom, setCurrentZoom] = useState(altitudeToZoom(1.5));

  useEffect(() => {
    onSiteClickRef.current = onSiteClick;
  }, [onSiteClick]);

  useEffect(() => {
    if (globeRef.current && pointOfView) {
      globeRef.current.pointOfView(pointOfView, 1000);
    }
  }, [pointOfView]);

  // Increase globe resolution for sharper zoom
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const checkReady = setInterval(() => {
      const scene = globe.scene?.();
      if (!scene) return;
      clearInterval(checkReady);

      // Find the globe mesh and increase geometry segments for smoother sphere at close zoom
      scene.traverse((obj: any) => {
        if (obj.isMesh && obj.geometry?.parameters?.widthSegments) {
          // Default is usually 75 segments - higher = smoother at close range
          // but we can't easily change geometry after creation
        }
        // Improve texture filtering
        if (obj.material?.map) {
          obj.material.map.anisotropy = 16;
          obj.material.map.needsUpdate = true;
        }
      });

      // Increase renderer pixel ratio for sharper rendering
      const renderer = globe.renderer?.();
      if (renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
      }
    }, 300);

    return () => clearInterval(checkReady);
  }, []);

  const clusterIndex = useMemo(() => {
    const index = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
    });

    const points = sites.map(site => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [site.lng, site.lat]
      },
      properties: { site }
    }));

    index.load(points as any);
    return index;
  }, [sites]);

  const clustersAndPoints = useMemo((): ClusterOrSite[] => {
    const raw = clusterIndex.getClusters([-180, -85, 180, 85], currentZoom);

    return raw.map((feature: any) => {
      if (feature.properties.cluster) {
        const leaves = clusterIndex.getLeaves(feature.properties.cluster_id, 100);
        const categoryCounts: Record<string, number> = {};
        leaves.forEach((leaf: any) => {
          const cat = leaf.properties.site.category;
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        const dominant = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0] as HistoricalSite['category'];

        return {
          id: `cluster-${feature.properties.cluster_id}`,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          isCluster: true,
          count: feature.properties.point_count,
          clusterId: feature.properties.cluster_id,
          dominantCategory: dominant,
        };
      } else {
        return {
          id: feature.properties.site.id,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          isCluster: false,
          count: 1,
          site: feature.properties.site,
        };
      }
    });
  }, [clusterIndex, currentZoom]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const checkControls = setInterval(() => {
      const controls = globe.controls?.();
      if (!controls) return;

      clearInterval(checkControls);

      const onCameraChange = () => {
        const pov = globe.pointOfView?.();
        if (!pov) return;
        const newZoom = altitudeToZoom(pov.altitude);
        setCurrentZoom(prev => {
          if (prev !== newZoom) return newZoom;
          return prev;
        });
      };

      controls.addEventListener('change', onCameraChange);
      onCameraChange();
    }, 200);

    return () => clearInterval(checkControls);
  }, []);

  const createPinElement = useCallback((d: object) => {
    const item = d as ClusterOrSite;

    const el = document.createElement('div');
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
    el.style.transition = 'transform 0.2s';

    if (item.isCluster) {
      const size = Math.min(48, 24 + item.count * 0.5);
      const color = categoryColors[item.dominantCategory || 'cultural'];

      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '2px solid rgba(255,255,255,0.9)';
      el.style.boxShadow = `0 0 10px ${color}80, 0 0 20px ${color}40`;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontSize = item.count > 99 ? '10px' : '11px';
      el.style.fontWeight = '700';
      el.style.fontFamily = 'system-ui, sans-serif';
      el.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
      el.textContent = `${item.count}`;

      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.3)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

      const zoomToCluster = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        if (globeRef.current) {
          const currentAlt = globeRef.current.pointOfView().altitude;
          globeRef.current.pointOfView({
            lat: item.lat,
            lng: item.lng,
            altitude: Math.max(0.1, currentAlt * 0.35)
          }, 800);
        }
      };
      el.addEventListener('click', zoomToCluster);
      el.addEventListener('touchend', zoomToCluster);

    } else {
      const site = item.site!;
      const color = categoryColors[site.category];
      const size = 6 + site.significance * 2;

      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '1.5px solid rgba(255,255,255,0.7)';
      el.style.boxShadow = `0 0 6px ${color}80, 0 0 12px ${color}30`;

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

      const selectSite = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        onSiteClickRef.current(site);
      };
      el.addEventListener('click', selectSite);
      el.addEventListener('touchend', selectSite);
    }

    return el;
  }, []);

  return (
    <div className="w-full h-full" style={{ position: 'relative' }}>
      <GlobeGL
        ref={globeRef}
        globeImageUrl={EARTH_TEXTURE}
        bumpImageUrl={EARTH_BUMP}
        backgroundImageUrl={NIGHT_SKY}

        atmosphereColor="#3a82f7"
        atmosphereAltitude={0.15}

        enablePointerInteraction={true}

        htmlElementsData={clustersAndPoints}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.01}
        htmlElement={createPinElement}
        htmlTransitionDuration={300}

        animateIn={true}
      />
    </div>
  );
}
