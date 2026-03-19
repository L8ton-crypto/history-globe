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

// Convert altitude (0.1 - 4.0) to supercluster zoom level (0-20)
function altitudeToZoom(altitude: number): number {
  // Higher altitude = lower zoom, closer = higher zoom
  const zoom = Math.round(14 - Math.log2(altitude * 10));
  return Math.max(0, Math.min(20, zoom));
}

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

  // Build supercluster index
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

  // Get clusters/points for current zoom level
  const clustersAndPoints = useMemo((): ClusterOrSite[] => {
    const raw = clusterIndex.getClusters([-180, -85, 180, 85], currentZoom);

    return raw.map((feature: any) => {
      if (feature.properties.cluster) {
        // It's a cluster
        const leaves = clusterIndex.getLeaves(feature.properties.cluster_id, 100);
        // Find dominant category
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
        // Individual site
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

  // Listen to camera and update zoom level
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

      return () => {
        controls.removeEventListener('change', onCameraChange);
      };
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
      // Cluster marker - numbered circle
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

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      // Click cluster to zoom in
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (globeRef.current) {
          globeRef.current.pointOfView({ lat: item.lat, lng: item.lng, altitude: Math.max(0.15, globeRef.current.pointOfView().altitude * 0.4) }, 800);
        }
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (globeRef.current) {
          globeRef.current.pointOfView({ lat: item.lat, lng: item.lng, altitude: Math.max(0.15, globeRef.current.pointOfView().altitude * 0.4) }, 800);
        }
      });

    } else {
      // Individual site pin
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

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSiteClickRef.current(site);
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSiteClickRef.current(site);
      });
    }

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

      htmlElementsData={clustersAndPoints}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.01}
      htmlElement={createPinElement}
      htmlTransitionDuration={300}
    />
  );
}
