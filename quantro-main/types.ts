import React from 'react';

export interface NavItem {
  icon: React.ReactNode;
  active?: boolean;
}

export enum TabOption {
  ScoreProperty = 'Score Property',
  SuggestedAreas = 'Suggested Areas',
  About = 'About'
}

export interface FactorResult {
  id: number;
  name: string;
  tier: string;
  weight_pct: number;
  score_0_20: number;
  contribution: number;
  confidence: string;
  notes: string;
}

export interface AmenityPoint {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  distance_miles: number | null;
  drive_minutes: number | null;
  route_geometry: string | null;
}

export interface SuggestionTract {
  GEOID: string;
  composite_score: number;
  letter_grade: string;
  opportunity: string;
  pass_fail: string;
  ladder_score: number;
  median_home_value: number | null;
  est_land_value: number | null;
  median_income: number | null;
  poverty_pct: number | null;
  lmi_pct: number | null;
  is_qct: number;
  is_oz: number;
  top_strengths: string;
  weaknesses: string;
  approx_lat: number;
  approx_lon: number;
}

export interface ScoreResponse {
  composite_score: number;
  letter_grade: string;
  opportunity_label: string;
  pass_fail: boolean;
  hard_excluded: boolean;
  exclusion_reason: string;
  channel_bonus: number;
  ladder_score: number;
  address: string;
  lat: number;
  lon: number;
  tract_geoid: string;
  factors: FactorResult[];
  amenities: AmenityPoint[];
  amenity_summary: Record<string, any>;
  similar_tracts: SuggestionTract[];
  tract_data: Record<string, any> | null;
  errors: string[];
  error?: string;
}

export interface ScoreRequest {
  address: string;
  parcel_type: string;
  flood_zone: string;
  brownfield: boolean;
  channel_city: boolean;
  channel_fannie: boolean;
  channel_institution: boolean;
  radius_m: number;
}
