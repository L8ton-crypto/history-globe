'use client';

import { useEffect, useRef, useState } from 'react';
import { HistoricalSite } from '@/data/sites';

interface InfoPanelProps {
  site: HistoricalSite | null;
  onClose: () => void;
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

export default function InfoPanel({ site, onClose }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  // Fetch image from Wikipedia API when site changes
  useEffect(() => {
    if (!site) {
      setImageUrl(null);
      setImageError(false);
      return;
    }

    setImageLoading(true);
    setImageError(false);
    setImageUrl(null);

    // Extract Wikipedia article title from the URL
    const wikiTitle = site.wikiUrl.split('/wiki/').pop() || site.name;

    fetch(`/api/wiki-image?title=${encodeURIComponent(wikiTitle)}`)
      .then(res => res.json())
      .then(data => {
        if (data.imageUrl) {
          setImageUrl(data.imageUrl);
        } else {
          setImageError(true);
        }
      })
      .catch(() => {
        setImageError(true);
      })
      .finally(() => {
        setImageLoading(false);
      });
  }, [site]);

  return (
    <>
      {/* Backdrop */}
      {site && (
        <div className="fixed inset-0 z-40 bg-black/30 md:bg-transparent" onClick={onClose} />
      )}

      <div
        ref={panelRef}
        className={`
          fixed z-50 bg-black/85 backdrop-blur-xl border-white/10 overflow-y-auto
          transition-transform duration-300 ease-in-out
          inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl border-t
          md:inset-x-auto md:inset-y-0 md:right-0 md:left-auto md:bottom-auto
          md:w-96 md:max-h-full md:rounded-t-none md:rounded-none md:border-t-0 md:border-l
          ${site ? 'translate-y-0 md:translate-x-0 md:translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
        `}
      >
        {site && (
          <>
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 md:top-4 md:right-4 w-8 h-8 flex items-center justify-center
                       text-white/70 hover:text-white hover:bg-white/10 rounded-full
                       transition-colors z-10"
            >
              ✕
            </button>

            <div className="p-4 md:p-6">
              {/* Image */}
              <div className="relative w-full h-40 md:h-48 mb-3 rounded-lg overflow-hidden">
                {imageLoading ? (
                  <div className="w-full h-full flex items-center justify-center
                                bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                  </div>
                ) : imageError || !imageUrl ? (
                  <div className="w-full h-full flex items-center justify-center text-white/40 text-sm
                                bg-gradient-to-br from-gray-800 to-gray-900">
                    No image available
                  </div>
                ) : (
                  <img
                    src={imageUrl}
                    alt={site.name}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                )}
              </div>

              {/* Title */}
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2 pr-8">
                {site.name}
              </h2>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/90">
                  {site.era}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white capitalize"
                  style={{ backgroundColor: categoryColors[site.category] }}
                >
                  {site.category}
                </span>
                {site.unesco && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                    🏛️ UNESCO
                  </span>
                )}
              </div>

              {/* Location */}
              <div className="text-white/60 text-sm mb-3">
                {site.country} › {site.region}
              </div>

              {/* Description */}
              <p className="text-white/90 text-sm mb-2 leading-relaxed">
                {site.shortDescription}
              </p>
              <p className="text-white/60 text-sm mb-4 leading-relaxed">
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
                📖 Read on Wikipedia ↗
              </a>

              {/* Significance */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-white/40 text-xs mb-1">Significance</div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-sm ${star <= site.significance ? 'text-yellow-400' : 'text-white/20'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
