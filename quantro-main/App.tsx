import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { DashboardCharts } from './components/DashboardCharts';
import { ScoreInput } from './components/ScoreInput';
import { KPIHeader } from './components/KPIHeader';
import { FactorBreakdown } from './components/FactorBreakdown';
import { FactorTable } from './components/FactorTable';
import { AmenityTable } from './components/AmenityTable';
import { AmenityMap } from './components/AmenityMap';
import { SuggestionsGrid } from './components/SuggestionsGrid';
import { AIChatPanel } from './components/AIChatPanel';
import { fetchAISearch, fetchScore } from './lib/api';
import { getCached, setCached, removeCached } from './lib/cache';
import { ComparePanel } from './components/ComparePanel';
import { TabOption } from './types';
import type { AISearchResult, ScoreRequest, ScoreResponse, SuggestionTract } from './types';

function AboutTab() {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-8 max-w-3xl">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Fort Worth Community Land Trust
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        A community land trust (CLT) is a nonprofit that owns the land and sells the home,
        keeping housing affordable permanently. Homebuyers purchase the house at a lower cost
        and agree to a resale formula that allows them to build equity while ensuring the home
        remains affordable for the next family. The CLT also provides long-term stewardship
        and support, which helps stabilize homeowners and neighborhoods.
      </p>

      <h3 className="text-lg font-semibold text-gray-800 mb-3">The 13 Acquisition Factors</h3>
      <div className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          'Neighborhood & Special Designations (TIF, PIA, NIP, Empowerment Zones)',
          'Nearby Amenities (Grocery, Pharmacy, Health Care, Conveniences)',
          'City Services (Roads, Utilities, Parks)',
          'Vacant Lots & Dilapidated Housing in the Area',
          'Site Safety, Lighting, Sidewalks & Walk Score',
          'Land Use (Zoning, Floodplain, Environmental, Negative Adjacencies)',
          'Construction & Development Cost Impacts',
          'Development Plans (Renovation, New Construction, Grading, Utilities)',
          'Community & Government Factors (Political Will, Neighborhood Sentiment)',
          'Displacement Risk & Gentrification Measures',
          'Neighborhood Strategy (Stability, Crime, Property Condition, Market Tier)',
          'Financial Projections & Project Pricing',
          'Investment Risk Assessment (Dealbreakers & Feasibility)',
        ].map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs font-mono text-gray-400 w-5 text-right mt-0.5">{i + 1}.</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold text-gray-800 mb-3">How Scoring Works</h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-3">
        Each factor is evaluated as <strong>High Opportunity</strong>, <strong>Baseline</strong>,
        or <strong>Low Opportunity</strong> based on the FWCLT acquisition rubric. Factors are
        weighted by priority and combined into a composite score from 0 to 100.
      </p>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" /> 75+ High Opportunity
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500" /> 50-74 Baseline
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" /> &lt;50 Low Opportunity
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabOption>(TabOption.ScoreProperty);
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoAddress, setAutoAddress] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResults, setAiResults] = useState<AISearchResult[]>([]);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [aiProvider, setAiProvider] = useState('');
  const [chartsOpen, setChartsOpen] = useState(false);
  const [amenityMapOpen, setAmenityMapOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [lastReq, setLastReq] = useState<ScoreRequest | null>(null);

  useEffect(() => {
    if (activeTab !== TabOption.ScoreProperty) {
      setChartsOpen(false);
      setAmenityMapOpen(false);
      setCompareOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!scoreData?.lat || !scoreData?.lon) setAmenityMapOpen(false);
  }, [scoreData]);

  const handleChartsOpenChange = useCallback((open: boolean) => {
    setAmenityMapOpen(false);
    setCompareOpen(false);
    setChartsOpen(open);
  }, []);

  const toggleAmenityMap = useCallback(() => {
    if (scoreData?.lat == null || scoreData?.lon == null) return;
    setChartsOpen(false);
    setCompareOpen(false);
    setAmenityMapOpen((o) => !o);
  }, [scoreData]);

  const toggleCompare = useCallback(() => {
    setChartsOpen(false);
    setAmenityMapOpen(false);
    setCompareOpen((o: boolean) => !o);
  }, []);

  const handleScore = useCallback(async (req: ScoreRequest) => {
    setLastReq(req);
    setAutoAddress(''); // clear so stale coordinates don't re-submit on next score
    const cached = getCached(req);
    if (cached) {
      setScoreData(cached);
      setFromCache(true);
      setError('');
      return;
    }
    setLoading(true);
    setFromCache(false);
    setError('');
    setScoreData(null);
    try {
      const data = await fetchScore(req);
      if (data.error) {
        setError(data.error);
      } else {
        setScoreData(data);
        setCached(req, data);
      }
    } catch (err: any) {
      setError(err.message || 'Scoring failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNewSearch = useCallback(() => {
    setScoreData(null);
    setFromCache(false);
    setLastReq(null);
    setError('');
    setAutoAddress('');
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!lastReq) return;
    removeCached(lastReq);
    setFromCache(false);
    setLoading(true);
    setError('');
    setScoreData(null);
    try {
      const data = await fetchScore(lastReq);
      if (data.error) {
        setError(data.error);
      } else {
        setScoreData(data);
        setCached(lastReq, data);
      }
    } catch (err: any) {
      setError(err.message || 'Scoring failed');
    } finally {
      setLoading(false);
    }
  }, [lastReq]);

  const handleAISearch = useCallback(async (query: string) => {
    setAiLoading(true);
    setAiError('');
    setAiWarnings([]);
    try {
      const data = await fetchAISearch(query, 8);
      if (data.error) {
        setAiError(data.error);
        setAiResults([]);
      } else {
        setAiResults(data.results || []);
        setAiWarnings(data.warnings || []);
        setAiProvider(data.provider || '');
      }
    } catch (err: any) {
      setAiError(err.message || 'AI search failed');
      setAiResults([]);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleSelectTract = useCallback((tract: SuggestionTract) => {
    const address = `${tract.approx_lat}, ${tract.approx_lon}`;
    setActiveTab(TabOption.ScoreProperty);
    handleScore({
      address,
      parcel_type: 'vacant',
      flood_zone: 'none',
      brownfield: false,
      channel_city: false,
      channel_fannie: false,
      channel_institution: false,
      radius_m: 8000,
    });
  }, [handleScore]);

  const handleSelectAIResult = useCallback((tract: AISearchResult) => {
    const address = `${tract.approx_lat}, ${tract.approx_lon}`;
    setAutoAddress(address);
    setActiveTab(TabOption.ScoreProperty);
    handleScore({
      address,
      parcel_type: 'vacant',
      flood_zone: 'none',
      brownfield: false,
      channel_city: false,
      channel_fannie: false,
      channel_institution: false,
      radius_m: 8000,
    });
  }, [handleScore]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setAutoAddress(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  }, []);

  const amenityMapCoords =
    scoreData?.lat != null && scoreData?.lon != null
      ? ([scoreData.lat, scoreData.lon] as [number, number])
      : null;

  return (
    <div className="min-h-screen bg-bgPrimary pb-12 font-sans selection:bg-green-200">
      <div className="max-w-[1280px] mx-auto pt-6 px-4 sm:px-8">
        <div className="bg-bgPrimary rounded-none sm:rounded-3xl overflow-visible">
          <Header activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="mt-8 px-2 sm:px-4">
            <Controls
              heading={
                activeTab === TabOption.SuggestedAreas
                  ? 'Top Scoring Areas'
                  : 'Acquisition Scorer'
              }
              showIconToolbar={activeTab === TabOption.ScoreProperty}
              chartsOpen={chartsOpen}
              onChartsOpenChange={handleChartsOpenChange}
              amenityMapOpen={amenityMapOpen}
              amenityMapEnabled={Boolean(amenityMapCoords)}
              onToggleAmenityMap={toggleAmenityMap}
              compareOpen={compareOpen}
              compareEnabled={Boolean(scoreData)}
              onToggleCompare={toggleCompare}
            />

            {activeTab === TabOption.ScoreProperty && chartsOpen && <DashboardCharts scoreData={scoreData} />}

            {activeTab === TabOption.ScoreProperty && compareOpen && scoreData && (
              <ComparePanel current={scoreData} onClose={() => setCompareOpen(false)} />
            )}

            {activeTab === TabOption.ScoreProperty &&
              !chartsOpen &&
              amenityMapOpen &&
              amenityMapCoords &&
              scoreData && (
                <AmenityMap
                  spread
                  center={amenityMapCoords}
                  amenities={scoreData.amenities}
                  onMapClick={handleMapClick}
                  address={scoreData.address}
                />
              )}

            {activeTab === TabOption.ScoreProperty && !chartsOpen && !amenityMapOpen && !compareOpen && (
              <>
                {!scoreData ? (
                  <ScoreInput
                    onScore={handleScore}
                    onAISearch={handleAISearch}
                    onSelectAIResult={handleSelectAIResult}
                    loading={loading}
                    aiLoading={aiLoading}
                    aiResults={aiResults}
                    aiWarnings={aiWarnings}
                    aiProvider={aiProvider}
                    aiError={aiError}
                    initialAddress={autoAddress}
                  />
                ) : (
                  <div className="flex items-center justify-between bg-white rounded-2xl shadow-soft px-5 py-4 mb-6">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-gray-900 truncate">{scoreData.address}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">
                          {scoreData.lat?.toFixed(6)}, {scoreData.lon?.toFixed(6)}
                        </span>
                        {scoreData.lat != null && scoreData.lon != null && (
                          <a
                            href={`https://www.google.com/maps?q=${scoreData.lat},${scoreData.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleNewSearch}
                      className="ml-4 shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      New Search
                    </button>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {scoreData && (
                  <>
                    <KPIHeader data={scoreData} fromCache={fromCache} onRefresh={handleRefresh} />
                    <AIChatPanel
                      key={`${scoreData.tract_geoid}-${scoreData.composite_score}`}
                      property={scoreData}
                    />
                    <FactorBreakdown factors={scoreData.factors} />
                    <FactorTable factors={scoreData.factors} />
                    <AmenityTable summary={scoreData.amenity_summary} />
                  </>
                )}

                {!scoreData && !loading && !error && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm font-medium mb-1">Enter a Fort Worth address to score</p>
                    <p className="text-xs text-gray-300">
                      Or switch to map view after scoring to explore nearby properties
                    </p>
                  </div>
                )}
              </>
            )}

            {activeTab === TabOption.SuggestedAreas && (
              <SuggestionsGrid onSelectTract={handleSelectTract} />
            )}

            {activeTab === TabOption.About && <AboutTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
