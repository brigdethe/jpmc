import type { ScoreRequest, ScoreResponse } from '../types';

// Primary store: canonical key (tract_geoid + scoring params) → response
const DATA_PREFIX = 'fwclt_score:';
// Secondary index: normalized user-input → canonical key
const IDX_PREFIX = 'fwclt_idx:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  data: ScoreResponse;
  cachedAt: number;
}

// Stable key from the API response — tract_geoid is the canonical identifier
function makeDataKey(tractGeoid: string, req: ScoreRequest): string {
  return DATA_PREFIX + JSON.stringify({
    g: tractGeoid,
    p: req.parcel_type,
    f: req.flood_zone,
    b: req.brownfield,
    cc: req.channel_city,
    cf: req.channel_fannie,
    ci: req.channel_institution,
    r: req.radius_m,
  });
}

// Lookup index so we can find the canonical key before making an API call
function makeIdxKey(req: ScoreRequest): string {
  return IDX_PREFIX + [
    req.address.trim().toLowerCase(),
    req.parcel_type,
    req.flood_zone,
    req.brownfield,
    req.channel_city,
    req.channel_fannie,
    req.channel_institution,
    req.radius_m,
  ].join('|');
}

export function getCached(req: ScoreRequest): ScoreResponse | null {
  try {
    // 1. Translate user-input address → canonical data key
    const canonicalKey = localStorage.getItem(makeIdxKey(req));
    if (!canonicalKey) return null;

    // 2. Fetch the actual data
    const raw = localStorage.getItem(canonicalKey);
    if (!raw) {
      // Index entry is stale — clean it up
      localStorage.removeItem(makeIdxKey(req));
      return null;
    }

    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > TTL_MS) {
      localStorage.removeItem(canonicalKey);
      localStorage.removeItem(makeIdxKey(req));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCached(req: ScoreRequest, data: ScoreResponse): void {
  try {
    const canonicalKey = makeDataKey(data.tract_geoid, req);
    const entry: CacheEntry = { data, cachedAt: Date.now() };

    // Store primary data
    localStorage.setItem(canonicalKey, JSON.stringify(entry));
    // Store index mapping so future lookups for this user-input find it
    localStorage.setItem(makeIdxKey(req), canonicalKey);
  } catch {
    // localStorage full — fail silently
  }
}

export function removeCached(req: ScoreRequest): void {
  try {
    const idxKey = makeIdxKey(req);
    const canonicalKey = localStorage.getItem(idxKey);
    if (canonicalKey) localStorage.removeItem(canonicalKey);
    localStorage.removeItem(idxKey);
  } catch {}
}

export function getCacheCount(): number {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(DATA_PREFIX)).length;
  } catch {
    return 0;
  }
}

export function clearAllCached(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(DATA_PREFIX) || k.startsWith(IDX_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}

export function listCached(): Array<{ data: ScoreResponse; cachedAt: number }> {
  const results: Array<{ data: ScoreResponse; cachedAt: number }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Only read primary data entries, not index entries
      if (!key?.startsWith(DATA_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.cachedAt <= TTL_MS) {
        results.push({ data: entry.data, cachedAt: entry.cachedAt });
      }
    }
  } catch {}
  return results.sort((a, b) => b.cachedAt - a.cachedAt);
}
