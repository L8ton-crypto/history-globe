'use client';

import { useState, useEffect } from 'react';
import { HistoricalSite } from '@/data/sites';

interface ControlsProps {
  sites: HistoricalSite[];
  activeCategories: Set<HistoricalSite['category']>;
  searchQuery: string;
  filteredSites: HistoricalSite[];
  totalAll?: number;
  onCategoryToggle: (category: HistoricalSite['category']) => void;
  onSearchChange: (query: string) => void;
  onSiteSelect: (site: HistoricalSite) => void;
  onNearMe: () => void;
  onResetView: () => void;
}

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
  totalAll,
  onCategoryToggle,
  onSearchChange,
  onSiteSelect,
  onNearMe,
  onResetView
}: ControlsProps) {
  const [searchResults, setSearchResults] = useState<HistoricalSite[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [geolocationSupported, setGeolocationSupported] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setGeolocationSupported('geolocation' in navigator);
  }, []);

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
    setIsExpanded(false);
  };

  return (
    <div className="fixed top-4 left-4 z-40 max-w-[calc(100vw-2rem)] md:max-w-sm">
      {/* Collapsed: just search + toggle button */}
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search sites..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 pl-9
                       text-white placeholder-white/50 text-sm
                       focus:outline-none focus:border-white/40 focus:bg-white/15
                       transition-all"
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 text-sm">
              🔍
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 w-9 h-9 flex items-center justify-center
                     bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg
                     text-white text-sm transition-colors"
            title={isExpanded ? 'Collapse' : 'Filters'}
          >
            {isExpanded ? '✕' : '☰'}
          </button>
        </div>

        {/* Site counter - always visible */}
        <div className="text-white/50 text-xs mt-2 px-1">
          {filteredSites.length.toLocaleString()} of {(totalAll || sites.length).toLocaleString()} sites
        </div>
      </div>

      {/* Search Results Dropdown */}
      {showSearchResults && searchResults.length > 0 && (
        <div className="mt-2 w-full bg-black/90 backdrop-blur-xl
                      border border-white/10 rounded-xl overflow-hidden">
          {searchResults.map((site) => (
            <button
              key={site.id}
              onClick={() => handleSearchResultClick(site)}
              className="w-full text-left px-4 py-3 hover:bg-white/10
                       border-b border-white/5 last:border-b-0 transition-colors"
            >
              <div className="text-white text-sm font-medium">{site.name}</div>
              <div className="text-white/60 text-xs mt-0.5">
                {site.country}, {site.region}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Expanded panel - categories + actions */}
      {isExpanded && (
        <div className="mt-2 bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-3 space-y-3">
          {/* Category Filters */}
          <div>
            <div className="text-white/70 text-xs font-medium mb-2">Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => {
                const isActive = activeCategories.has(category.key);
                return (
                  <button
                    key={category.key}
                    onClick={() => onCategoryToggle(category.key)}
                    className={`
                      px-2.5 py-1 rounded-full text-xs font-medium transition-all
                      border
                      ${isActive
                        ? 'text-white border-transparent'
                        : 'text-white/60 border-white/20 hover:text-white hover:bg-white/10'
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
          <div className="flex gap-2">
            {geolocationSupported && (
              <button
                onClick={() => { onNearMe(); setIsExpanded(false); }}
                className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20
                         border border-white/20 rounded-lg text-white text-xs font-medium
                         transition-colors flex items-center justify-center gap-1.5"
              >
                📍 Near Me
              </button>
            )}
            <button
              onClick={() => { onResetView(); setIsExpanded(false); }}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20
                       border border-white/20 rounded-lg text-white text-xs font-medium
                       transition-colors flex items-center justify-center gap-1.5"
            >
              🌍 Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
