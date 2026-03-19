'use client';

import { useState, useEffect } from 'react';
import { HistoricalSite } from '@/data/sites';

interface ControlsProps {
  sites: HistoricalSite[];
  activeCategories: Set<HistoricalSite['category']>;
  searchQuery: string;
  filteredSites: HistoricalSite[];
  onCategoryToggle: (category: HistoricalSite['category']) => void;
  onSearchChange: (query: string) => void;
  onSiteSelect: (site: HistoricalSite) => void;
  onNearMe: () => void;
  onResetView: () => void;
}

// Category colors and labels
const categories: Array<{
  key: HistoricalSite['category'];
  label: string;
  color: string;
}> = [
  { key: 'roman', label: 'Roman', color: '#DC2626' },
  { key: 'medieval', label: 'Medieval', color: '#2563EB' },
  { key: 'ancient', label: 'Ancient', color: '#D97706' },
  { key: 'natural', label: 'Natural', color: '#16A34A' },
  { key: 'cultural', label: 'Cultural', color: '#9333EA' },
  { key: 'industrial', label: 'Industrial', color: '#F97316' },
  { key: 'religious', label: 'Religious', color: '#EC4899' },
];

export default function Controls({
  sites,
  activeCategories,
  searchQuery,
  filteredSites,
  onCategoryToggle,
  onSearchChange,
  onSiteSelect,
  onNearMe,
  onResetView
}: ControlsProps) {
  const [searchResults, setSearchResults] = useState<HistoricalSite[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [geolocationSupported, setGeolocationSupported] = useState(false);

  // Check geolocation support
  useEffect(() => {
    setGeolocationSupported('geolocation' in navigator);
  }, []);

  // Update search results
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const results = sites
        .filter(site => 
          site.name.toLowerCase().includes(query) ||
          site.country.toLowerCase().includes(query) ||
          site.region.toLowerCase().includes(query)
        )
        .slice(0, 8);
      setSearchResults(results);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery, sites]);

  const handleSearchResultClick = (site: HistoricalSite) => {
    onSiteSelect(site);
    onSearchChange('');
    setShowSearchResults(false);
  };

  return (
    <div className="fixed top-4 left-4 z-40 space-y-4 max-w-sm">
      {/* Search */}
      <div className="relative">
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search sites, countries, regions..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 pl-10
                       text-white placeholder-white/50 text-sm
                       focus:outline-none focus:border-white/40 focus:bg-white/15
                       transition-all"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
              🔍
            </div>
          </div>
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-black/90 backdrop-blur-xl 
                        border border-white/10 rounded-xl overflow-hidden z-50">
            {searchResults.map((site) => (
              <button
                key={site.id}
                onClick={() => handleSearchResultClick(site)}
                className="w-full text-left px-4 py-3 hover:bg-white/10 
                         border-b border-white/5 last:border-b-0 transition-colors"
              >
                <div className="text-white text-sm font-medium">{site.name}</div>
                <div className="text-white/60 text-xs mt-1">
                  {site.country}, {site.region} • {site.era}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Filters */}
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="text-white text-sm font-medium mb-3">Categories</div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isActive = activeCategories.has(category.key);
            return (
              <button
                key={category.key}
                onClick={() => onCategoryToggle(category.key)}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium transition-all
                  border border-white/20
                  ${isActive 
                    ? 'text-white' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }
                `}
                style={{
                  backgroundColor: isActive ? category.color : 'transparent'
                }}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-3">
        {geolocationSupported && (
          <button
            onClick={onNearMe}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 
                     border border-white/20 rounded-lg text-white text-sm font-medium
                     transition-colors flex items-center justify-center gap-2"
          >
            📍 Near Me
          </button>
        )}
        
        <button
          onClick={onResetView}
          className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 
                   border border-white/20 rounded-lg text-white text-sm font-medium
                   transition-colors flex items-center justify-center gap-2"
        >
          🌍 Reset View
        </button>
      </div>

      {/* Site Counter */}
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="text-white/70 text-xs">
          Showing {filteredSites.length} of {sites.length} sites
        </div>
      </div>
    </div>
  );
}