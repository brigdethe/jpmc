import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';
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
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h2 className="text-lg font-semibold text-gray-800">Top Scoring Areas</h2>
        <span className="text-xs text-gray-400 ml-2">{suggestions.length} areas found</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        These areas scored highest based on tract-level data across all 13 acquisition factors. 
        Click any card to score the full property with live amenity data.
      </p>
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
