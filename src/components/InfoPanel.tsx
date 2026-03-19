'use client';

import { useEffect, useRef, useState } from 'react';
import { HistoricalSite } from '@/data/sites';

interface InfoPanelProps {
  site: HistoricalSite | null;
  onClose: () => void;
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

export default function InfoPanel({ site, onClose }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (site) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [site, onClose]);

  // Reset image error state when site changes
  useEffect(() => {
    setImageError(false);
  }, [site]);

  if (!site) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div 
        ref={panelRef}
        className={`
          w-full md:w-96 h-full bg-black/80 backdrop-blur-xl border-l border-white/10
          transform transition-transform duration-300 ease-in-out pointer-events-auto
          ${site ? 'translate-x-0' : 'translate-x-full'}
          overflow-y-auto
        `}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
                     text-white/70 hover:text-white hover:bg-white/10 rounded-full
                     transition-colors z-10"
        >
          ✕
        </button>

        <div className="p-6">
          {/* Image */}
          <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
            {imageError ? (
              <div 
                className="w-full h-full flex items-center justify-center text-white/50 text-sm
                          bg-gradient-to-br from-gray-800 to-gray-900"
              >
                Image not available
              </div>
            ) : (
              <img
                src={site.imageUrl}
                alt={site.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {site.name}
          </h2>

          {/* Era and Category badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/90">
              {site.era}
            </span>
            <span 
              className="px-3 py-1 rounded-full text-xs font-medium text-white capitalize"
              style={{ backgroundColor: categoryColors[site.category] }}
            >
              {site.category}
            </span>
          </div>

          {/* Location */}
          <div className="text-white/70 text-sm mb-4">
            {site.country} › {site.region}
          </div>

          {/* UNESCO badge */}
          {site.unesco && (
            <div className="mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                🏛️ UNESCO World Heritage Site
              </span>
            </div>
          )}

          {/* Short description */}
          <p className="text-white/90 text-sm mb-4 leading-relaxed">
            {site.shortDescription}
          </p>

          {/* Long description */}
          <p className="text-white/70 text-sm mb-6 leading-relaxed">
            {site.longDescription}
          </p>

          {/* Wikipedia link */}
          <a
            href={site.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-white/10 hover:bg-white/20 text-white text-sm font-medium
                     transition-colors border border-white/20"
          >
            <span>📖</span>
            Read on Wikipedia
            <span className="text-xs">↗</span>
          </a>

          {/* Significance indicator */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="text-white/50 text-xs mb-2">Historical Significance</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${
                    star <= site.significance ? 'text-yellow-400' : 'text-white/20'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}