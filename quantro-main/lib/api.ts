import type { AIChatMessage, AIChatResponse, AISearchResponse, ScoreRequest, ScoreResponse, SuggestionTract } from '../types';

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

export async function fetchAISearch(query: string, top = 8): Promise<AISearchResponse> {
  const res = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top }),
  });
  if (!res.ok) throw new Error(`AI search failed: ${res.status}`);
  return res.json();
}

export async function sendAIChat(
  question: string,
  property: ScoreResponse,
  history: AIChatMessage[],
): Promise<AIChatResponse> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, property, history }),
  });
  if (!res.ok) throw new Error(`AI chat failed: ${res.status}`);
  return res.json();
}
