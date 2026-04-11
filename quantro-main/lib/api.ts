import type { ScoreRequest, ScoreResponse, SuggestionTract } from '../types';

export async function fetchScore(req: ScoreRequest): Promise<ScoreResponse> {
  const res = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Score request failed: ${res.status}`);
  return res.json();
}

export async function fetchSuggestions(top = 12): Promise<SuggestionTract[]> {
  const res = await fetch(`/api/suggestions?top=${top}`);
  if (!res.ok) throw new Error(`Suggestions request failed: ${res.status}`);
  return res.json();
}

export async function fetchTractData(geoid: string): Promise<Record<string, any>> {
  const res = await fetch(`/api/tract/${encodeURIComponent(geoid)}`);
  if (!res.ok) throw new Error(`Tract data request failed: ${res.status}`);
  return res.json();
}
