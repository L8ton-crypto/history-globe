'use client';

import { useState, useMemo, useCallback } from 'react';
import { HistoricalSite } from '@/data/sites';
import { useStaticSites } from '@/hooks/useStaticSites';
import GlobeComponent from '@/components/Globe';
import InfoPanel from '@/components/InfoPanel';
import Controls from '@/components/Controls';

const categoryColors: Record<HistoricalSite['category'], string> = {
  roman: '#DC2626',
  medieval: '#2563EB',
  ancient: '#D97706',
  natural: '#16A34A',
  cultural: '#9333EA',
  industrial: '#F97316',
  religious: '#EC4899'
};

const categories = [
  { key: 'roman' as const, label: 'Roman' },
  { key: 'medieval' as const, label: 'Medieval' },
  { key: 'ancient' as const, label: 'Ancient' },
  { key: 'natural' as const, label: 'Natural' },
  { key: 'cultural' as const, label: 'Cultural' },
  { key: 'industrial' as const, label: 'Industrial' },
  { key: 'religious' as const, label: 'Religious' },
];

export default function Home() {
  const [selectedSite, setSelectedSite] = useState<HistoricalSite | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<HistoricalSite['category']>>(
    new Set(['roman', 'medieval', 'ancient', 'natural', 'cultural', 'industrial', 'religious'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [pointOfView, setPointOfView] = useState<{lat: number; lng: number; altitude: number} | undefined>(undefined);

  const { geojson, loading, totalAll, fetchSiteDetail } = useStaticSites();

  // For Controls search results - filter from GeoJSON features
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !geojson) return [];
    const q = searchQuery.toLowerCase();
    return geojson.features
      .filter(f => f.properties?.name?.toLowerCase().includes(q))
      .slice(0, 50)
      .map(f => ({
        id: f.properties!.id,
        name: f.properties!.name,
        lat: (f.geometry as GeoJSON.Point).coordinates[1],
        lng: (f.geometry as GeoJSON.Point).coordinates[0],
        category: f.properties!.category as HistoricalSite['category'],
        era: '',
        shortDescription: '',
        longDescription: '',
        imageUrl: '',
        wikiUrl: '',
        country: f.properties!.country || '',
        region: '',
        unesco: false,
        significance: f.properties!.significance || 3,
      })) as HistoricalSite[];
  }, [searchQuery, geojson]);

  // Count filtered sites for display
  const filteredCount = useMemo(() => {
    if (!geojson) return 0;
    return geojson.features.filter(f => 
      activeCategories.has(f.properties?.category as HistoricalSite['category'])
    ).length;
  }, [geojson, activeCategories]);

  const handleCategoryToggle = useCallback((category: HistoricalSite['category']) => {
    setActiveCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const handleSiteClick = useCallback(async (dbId: number) => {
    const site = await fetchSiteDetail(dbId);
    if (site) setSelectedSite(site);
  }, [fetchSiteDetail]);

  const handleSearchSiteSelect = useCallback((site: HistoricalSite) => {
    // Fly to site and show info
    setPointOfView({ lat: site.lat, lng: site.lng, altitude: 0.5 });
    // Also fetch full details
    const dbIdMatch = site.id.match(/^db-(\d+)$/);
    if (dbIdMatch) {
      fetchSiteDetail(parseInt(dbIdMatch[1])).then(full => {
        if (full) setSelectedSite(full);
      });
    }
  }, [fetchSiteDetail]);

  const handleNearMe = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPointOfView({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            altitude: 1.0
          });
        },
        () => {
          alert('Unable to get your location. Please enable location access.');
        }
      );
    }
  }, []);

  const handleResetView = useCallback(() => {
    setPointOfView({ lat: 52, lng: -3, altitude: 1.5 });
    setSelectedSite(null);
  }, []);

  const handleCloseInfoPanel = useCallback(() => {
    setSelectedSite(null);
  }, []);

  return (
    <div className="h-screen w-full bg-[#0a0a0a] relative overflow-hidden">
      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <h1 className="text-white text-lg md:text-2xl font-bold tracking-wide opacity-80">
          🌍 HistoryGlobe
        </h1>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-black/60 backdrop-blur px-3 py-1 rounded-full text-white/70 text-xs">
            Loading {totalAll > 0 ? `${totalAll.toLocaleString()} sites` : 'sites'}...
          </div>
        </div>
      )}

      {/* Globe */}
      <div className="absolute inset-0 z-10">
        <GlobeComponent
          geojson={geojson}
          activeCategories={activeCategories}
          onSiteClick={handleSiteClick}
          pointOfView={pointOfView}
        />
      </div>

      {/* Controls */}
      <Controls
        sites={searchResults}
        activeCategories={activeCategories}
        searchQuery={searchQuery}
        filteredSites={searchResults}
        totalAll={totalAll}
        onCategoryToggle={handleCategoryToggle}
        onSearchChange={setSearchQuery}
        onSiteSelect={handleSearchSiteSelect}
        onNearMe={handleNearMe}
        onResetView={handleResetView}
      />

      {/* Category Legend - desktop only */}
      <div className="hidden md:block fixed bottom-4 left-4 z-30 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="text-white/60 text-xs font-medium mb-2">
          {filteredCount.toLocaleString()} of {totalAll.toLocaleString()} sites
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-xs">
          {categories.map(category => (
            <div key={category.key} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: categoryColors[category.key] }}
              />
              <span className="text-white/70">{category.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info Panel */}
      <InfoPanel
        site={selectedSite}
        onClose={handleCloseInfoPanel}
      />
    </div>
  );
}
