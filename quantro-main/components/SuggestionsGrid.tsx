import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { fetchSuggestions } from '../lib/api';
import { SuggestionCard } from './SuggestionCard';
import type { SuggestionTract } from '../types';

interface SuggestionsGridProps {
  onSelectTract: (tract: SuggestionTract) => void;
}

export const SuggestionsGrid: React.FC<SuggestionsGridProps> = ({ onSelectTract }) => {
  const [suggestions, setSuggestions] = useState<SuggestionTract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSuggestions(12)
      .then((data) => {
        if (!cancelled) {
          setSuggestions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Loading top-scoring areas...</p>
        <p className="text-xs text-gray-300">Pre-scoring all tracts (first load may take a moment)</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500 text-sm">
        Failed to load suggestions: {error}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No high-scoring areas found in the dataset.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-800">
        <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
        <span>
          These scores are <strong>estimates</strong> based on census tract data only — nearby amenities are not included.
          <br />Scores may differ when you score a specific property directly.
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suggestions.map((tract, i) => (
          <SuggestionCard
            key={tract.GEOID}
            tract={tract}
            index={i}
            onSelect={onSelectTract}
          />
        ))}
      </div>
    </motion.div>
  );
};
