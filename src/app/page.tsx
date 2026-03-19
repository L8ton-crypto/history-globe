'use client';

import { useState, useMemo, useCallback } from 'react';
import { historicalSites, HistoricalSite } from '@/data/sites';
import { importedSites } from '@/data/imported-sites';

// Merge manual + imported sites
const allSites = [...historicalSites, ...importedSites];
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
  const [pointOfView, setPointOfView] = useState<{lat: number; lng: number; altitude: number}>({
    lat: 52,
    lng: -3,
    altitude: 1.5
  });

  const filteredSites = useMemo(() => {
    let filtered = allSites.filter(site => activeCategories.has(site.category));
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(site =>
        site.name.toLowerCase().includes(query) ||
        site.country.toLowerCase().includes(query) ||
        site.region.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [activeCategories, searchQuery]);

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

  const handleSiteClick = useCallback((site: HistoricalSite) => {
    setSelectedSite(site);
    // Don't change zoom - just open the info panel
  }, []);

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
      {/* Title - smaller on mobile */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <h1 className="text-white text-lg md:text-2xl font-bold tracking-wide opacity-80">
          🌍 HistoryGlobe
        </h1>
      </div>

      {/* Globe - z-10 so pins stay below controls (z-40) */}
      <div className="absolute inset-0 z-10">
        <GlobeComponent
          sites={filteredSites}
          onSiteClick={handleSiteClick}
          pointOfView={pointOfView}
        />
      </div>

      {/* Controls */}
      <Controls
        sites={allSites}
        activeCategories={activeCategories}
        searchQuery={searchQuery}
        filteredSites={filteredSites}
        onCategoryToggle={handleCategoryToggle}
        onSearchChange={setSearchQuery}
        onSiteSelect={handleSiteClick}
        onNearMe={handleNearMe}
        onResetView={handleResetView}
      />

      {/* Category Legend - hidden on mobile, shown on desktop */}
      <div className="hidden md:block fixed bottom-4 left-4 z-30 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="text-white/60 text-xs font-medium mb-2">Legend</div>
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
