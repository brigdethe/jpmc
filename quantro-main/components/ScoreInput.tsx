import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import Flip from 'gsap/Flip';
import { Search, MapPin, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { AISearchResults } from './AISearchResults';
import type { AISearchResult, ScoreRequest } from '../types';

interface ScoreInputProps {
  onScore: (req: ScoreRequest) => void;
  onAISearch: (query: string) => void;
  onSelectAIResult: (tract: AISearchResult) => void;
  loading: boolean;
  aiLoading: boolean;
  aiResults: AISearchResult[];
  aiWarnings: string[];
  aiProvider: string;
  aiError: string;
  initialAddress?: string;
}

const EXTRA_MENU_W = 232;
const EXTRA_MENU_CAP = 400;
const VIEW_GUTTER = 8;

const MENU_GAP = 6;

type PlateCoord = { left: number; maxHeight: number } & ({ top: number } | { bottom: number });

function useAnchoredPortal(menuWidth: number) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [plate, setPlate] = useState<PlateCoord | null>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - menuWidth;
    left = Math.max(VIEW_GUTTER, Math.min(left, vw - menuWidth - VIEW_GUTTER));
    const belowTop = r.bottom + MENU_GAP;
    const spaceBelow = vh - belowTop - VIEW_GUTTER;
    const spaceAboveBudget = r.top - VIEW_GUTTER;
    const useBelow = spaceBelow >= 160 || spaceBelow >= spaceAboveBudget - 80;
    if (useBelow) {
      setPlate({
        left,
        top: belowTop,
        maxHeight: Math.min(EXTRA_MENU_CAP, Math.max(120, spaceBelow)),
      });
    } else {
      setPlate({
        left,
        bottom: vh - r.top + MENU_GAP,
        maxHeight: Math.min(EXTRA_MENU_CAP, Math.max(120, r.top - VIEW_GUTTER - MENU_GAP)),
      });
    }
  }, [menuWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setPlate(null);
      return;
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return { open, setOpen, btnRef, panelRef, plate };
}

const MENU_BTN_CLASS =
  'flex items-center gap-1 justify-between shrink-0 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-2 pr-2 text-left text-xs text-gray-700 hover:bg-gray-100';

const PARCEL_MENU_W = 120;
const FLOOD_MENU_W = 146;

const PARCEL_OPTS = [
  { value: 'vacant', label: 'Vacant' },
  { value: 'improved', label: 'Improved' },
] as const;

const FLOOD_OPTS = [
  { value: 'none', label: 'No flood' },
  { value: '500yr', label: '500-yr' },
  { value: '100yr', label: '100-yr' },
  { value: 'floodway_critical', label: 'Floodway' },
] as const;

gsap.registerPlugin(Flip);

export const ScoreInput: React.FC<ScoreInputProps> = ({
  onScore,
  onAISearch,
  onSelectAIResult,
  loading,
  aiLoading,
  aiResults,
  aiWarnings,
  aiProvider,
  aiError,
  initialAddress,
}) => {
  const [address, setAddress] = useState(initialAddress || '');
  const [aiMode, setAiMode] = useState(false);
  const [parcelType, setParcelType] = useState('vacant');
  const [floodZone, setFloodZone] = useState('none');
  const [brownfield, setBrownfield] = useState(false);
  const [channelCity, setChannelCity] = useState(false);
  const [channelFannie, setChannelFannie] = useState(false);
  const [channelInstitution, setChannelInstitution] = useState(false);
  const parcelPortal = useAnchoredPortal(PARCEL_MENU_W);
  const floodPortal = useAnchoredPortal(FLOOD_MENU_W);
  const extrasPortal = useAnchoredPortal(EXTRA_MENU_W);

  const inputShellRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);

  const parcelLabel =
    PARCEL_OPTS.find((o) => o.value === parcelType)?.label ?? parcelType;
  const floodLabel = FLOOD_OPTS.find((o) => o.value === floodZone)?.label ?? floodZone;

  const extrasIdle =
    !brownfield && !channelCity && !channelFannie && !channelInstitution;
  const extrasSummary = extrasIdle
    ? 'Site & financing'
    : [
        brownfield ? 'Brownfield' : null,
        channelCity ? 'City' : null,
        channelFannie ? 'Fannie' : null,
        channelInstitution ? 'Inst.' : null,
      ]
        .filter(Boolean)
        .join(', ');

  useEffect(() => {
    if (initialAddress) setAddress(initialAddress);
  }, [initialAddress]);

  useLayoutEffect(() => {
    const snap = flipStateRef.current;
    if (!snap) return;
    flipStateRef.current = null;
    Flip.from(snap, {
      duration: 0.48,
      ease: 'power2.inOut',
    });
  }, [aiMode]);

  const toggleAiMode = () => {
    const shell = inputShellRef.current;
    flipStateRef.current = shell ? Flip.getState(shell) : null;
    setAiMode((v) => !v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    if (aiMode) {
      onAISearch(address.trim());
      return;
    }
    onScore({
      address: address.trim(),
      parcel_type: parcelType,
      flood_zone: floodZone,
      brownfield,
      channel_city: channelCity,
      channel_fannie: channelFannie,
      channel_institution: channelInstitution,
      radius_m: 8000,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-soft px-3 py-2 mb-4"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-2">
          <div
            ref={inputShellRef}
            className="relative flex-1 min-w-[min(100%,12rem)]"
          >
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={aiMode ? 'e.g. transit-friendly, low flood risk' : 'Address or lat, lon'}
              className="w-full pl-9 pr-10 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 border border-gray-200 focus:border-gray-400 focus:outline-none placeholder:text-gray-400"
            />
            <button
              type="button"
              title={aiMode ? 'Address scoring' : 'AI area finder'}
              onClick={toggleAiMode}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                aiMode ? 'bg-black text-white' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>

          {!aiMode && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative shrink-0">
                <button
                  ref={parcelPortal.btnRef}
                  type="button"
                  aria-expanded={parcelPortal.open}
                  aria-haspopup="listbox"
                  aria-label="Parcel type"
                  onClick={() => {
                    floodPortal.setOpen(false);
                    extrasPortal.setOpen(false);
                    parcelPortal.setOpen((prev) => !prev);
                  }}
                  className={`${MENU_BTN_CLASS} min-w-[6.75rem]`}
                >
                  <span className="truncate">{parcelLabel}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-50 ${parcelPortal.open ? 'rotate-180' : ''}`}
                  />
                </button>
                {parcelPortal.open &&
                  parcelPortal.plate &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      ref={parcelPortal.panelRef}
                      role="listbox"
                      aria-label="Parcel type"
                      className="rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      style={{
                        position: 'fixed',
                        left: parcelPortal.plate.left,
                        width: PARCEL_MENU_W,
                        maxHeight: parcelPortal.plate.maxHeight,
                        overflowY: 'auto',
                        zIndex: 2000,
                        ...('top' in parcelPortal.plate
                          ? { top: parcelPortal.plate.top }
                          : { bottom: parcelPortal.plate.bottom }),
                      }}
                    >
                      {PARCEL_OPTS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={parcelType === value}
                          className={`w-full px-2 py-1.5 text-left text-xs ${
                            parcelType === value
                              ? 'bg-gray-100 font-medium text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setParcelType(value);
                            parcelPortal.setOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
              </div>
              <div className="relative shrink-0">
                <button
                  ref={floodPortal.btnRef}
                  type="button"
                  aria-expanded={floodPortal.open}
                  aria-haspopup="listbox"
                  aria-label="Flood zone"
                  onClick={() => {
                    parcelPortal.setOpen(false);
                    extrasPortal.setOpen(false);
                    floodPortal.setOpen((prev) => !prev);
                  }}
                  className={`${MENU_BTN_CLASS} min-w-[5.75rem]`}
                >
                  <span className="truncate">{floodLabel}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-50 ${floodPortal.open ? 'rotate-180' : ''}`}
                  />
                </button>
                {floodPortal.open &&
                  floodPortal.plate &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      ref={floodPortal.panelRef}
                      role="listbox"
                      aria-label="Flood zone"
                      className="rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      style={{
                        position: 'fixed',
                        left: floodPortal.plate.left,
                        width: FLOOD_MENU_W,
                        maxHeight: floodPortal.plate.maxHeight,
                        overflowY: 'auto',
                        zIndex: 2000,
                        ...('top' in floodPortal.plate
                          ? { top: floodPortal.plate.top }
                          : { bottom: floodPortal.plate.bottom }),
                      }}
                    >
                      {FLOOD_OPTS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={floodZone === value}
                          className={`w-full px-2 py-1.5 text-left text-xs ${
                            floodZone === value
                              ? 'bg-gray-100 font-medium text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setFloodZone(value);
                            floodPortal.setOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
              </div>
              <div className="relative shrink-0">
                <button
                  ref={extrasPortal.btnRef}
                  type="button"
                  aria-expanded={extrasPortal.open}
                  aria-haspopup="dialog"
                  onClick={() => {
                    parcelPortal.setOpen(false);
                    floodPortal.setOpen(false);
                    extrasPortal.setOpen((prev) => !prev);
                  }}
                  className={`${MENU_BTN_CLASS} min-w-[7.75rem] max-w-[10.5rem]`}
                >
                  <span className="truncate">{extrasSummary}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-50 ${extrasPortal.open ? 'rotate-180' : ''}`}
                  />
                </button>
                {extrasPortal.open &&
                  extrasPortal.plate &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      ref={extrasPortal.panelRef}
                      role="dialog"
                      aria-label="Site type and financing channels"
                      className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg"
                      style={{
                        position: 'fixed',
                        left: extrasPortal.plate.left,
                        width: EXTRA_MENU_W,
                        maxHeight: extrasPortal.plate.maxHeight,
                        overflowY: 'auto',
                        zIndex: 2000,
                        ...('top' in extrasPortal.plate
                          ? { top: extrasPortal.plate.top }
                          : { bottom: extrasPortal.plate.bottom }),
                      }}
                    >
                      <div className="mb-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Site
                        </p>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="ex-bf-0" className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-50">
                            <input
                              id="ex-bf-0"
                              type="radio"
                              name="extras-brownfield"
                              checked={!brownfield}
                              onChange={() => setBrownfield(false)}
                              className="h-3.5 w-3.5 shrink-0 border-gray-300 text-gray-900"
                            />
                            <span className="text-xs text-gray-700">Not brownfield</span>
                          </label>
                          <label htmlFor="ex-bf-1" className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-50">
                            <input
                              id="ex-bf-1"
                              type="radio"
                              name="extras-brownfield"
                              checked={brownfield}
                              onChange={() => setBrownfield(true)}
                              className="h-3.5 w-3.5 shrink-0 border-gray-300 text-gray-900"
                            />
                            <span className="text-xs text-gray-700">Brownfield</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Channels
                        </p>
                        {(
                          [
                            [
                              'City',
                              channelCity,
                              setChannelCity,
                              'extras-ch-city-off',
                              'extras-ch-city-on',
                              'extras-ch-city',
                            ],
                            [
                              'Fannie Mae',
                              channelFannie,
                              setChannelFannie,
                              'extras-ch-fn-off',
                              'extras-ch-fn-on',
                              'extras-ch-fn',
                            ],
                            [
                              'Institution',
                              channelInstitution,
                              setChannelInstitution,
                              'extras-ch-inst-off',
                              'extras-ch-inst-on',
                              'extras-ch-inst',
                            ],
                          ] as const
                        ).map(([label, on, setter, rid0, rid1, grp]) => (
                          <div key={grp} className="mb-2 last:mb-0">
                            <p className="mb-1 pl-0.5 text-[10px] text-gray-600">{label}</p>
                            <div className="flex flex-col gap-0.5">
                              <label htmlFor={`${rid0}`} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-50">
                                <input
                                  id={`${rid0}`}
                                  type="radio"
                                  name={grp}
                                  checked={!on}
                                  onChange={() => setter(false)}
                                  className="h-3.5 w-3.5 shrink-0 border-gray-300 text-gray-900"
                                />
                                <span className="text-xs text-gray-700">Off</span>
                              </label>
                              <label htmlFor={`${rid1}`} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-50">
                                <input
                                  id={`${rid1}`}
                                  type="radio"
                                  name={grp}
                                  checked={on}
                                  onChange={() => setter(true)}
                                  className="h-3.5 w-3.5 shrink-0 border-gray-300 text-gray-900"
                                />
                                <span className="text-xs text-gray-700">On</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || aiLoading || !address.trim()}
            title={aiLoading ? 'Finding' : loading ? 'Scoring' : 'Search'}
            aria-label="Search"
            className="shrink-0 w-10 h-10 flex items-center justify-center bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading || aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        {aiError && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-sm text-red-700">
            {aiError}
          </div>
        )}

        {aiMode && !aiLoading && aiResults.length > 0 && (
          <div className="mt-3">
            <AISearchResults
              results={aiResults}
              warnings={aiWarnings}
              provider={aiProvider}
              onSelect={onSelectAIResult}
            />
          </div>
        )}
      </form>
    </motion.div>
  );
};
