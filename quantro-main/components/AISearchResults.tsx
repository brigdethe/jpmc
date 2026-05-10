import React from 'react';
import { AlertCircle, BrainCircuit, Sparkles } from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';
import type { AISearchResult } from '../types';

interface AISearchResultsProps {
  results: AISearchResult[];
  warnings: string[];
  provider: string;
  onSelect: (tract: AISearchResult) => void;
}

export const AISearchResults: React.FC<AISearchResultsProps> = ({ results, warnings, provider, onSelect }) => {
  if (results.length === 0) {
    return (
      <div className="mt-5 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
        No matching areas found. Try broadening the score, flood, or value constraints.
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-800">AI-matched areas</h3>
          <span className="text-xs text-gray-400">{results.length} results</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <BrainCircuit className="w-3.5 h-3.5" />
          {provider === 'local' ? 'local keyword parser' : provider}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="flex items-start gap-2 mb-4 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{warnings[0]}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {results.map((tract, i) => (
          <div key={tract.GEOID} className="flex flex-col gap-2">
            <SuggestionCard tract={tract} index={i} onSelect={onSelect} />
            <div className="rounded-xl bg-white border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Match</span>
                <span className="text-xs font-semibold text-gray-700">{Math.round(tract.match_score)}</span>
              </div>
              <div className="space-y-1">
                {(tract.match_reasons || []).slice(0, 3).map((reason) => (
                  <p key={reason} className="text-[11px] leading-snug text-gray-500">
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
