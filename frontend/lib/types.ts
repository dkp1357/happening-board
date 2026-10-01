export type EventCategory =
  | "military_conflict"
  | "civil_unrest"
  | "terror_security"
  | "diplomacy"
  | "humanitarian"
  | "infrastructure_cyber"
  | "other";

export type SeverityLevel = 1 | 2 | 3 | 4 | 5;

export interface EventItem {
  id: string;
  title: string;
  summary: string;
  category: EventCategory;
  severity: SeverityLevel;
  latitude: number;
  longitude: number;
  location_name: string | null;
  country_code: string | null;
  source_url: string;
  source_domain: string | null;
  actor1?: string | null;
  actor2?: string | null;
  key_actors: string[];
  goldstein_scale?: number | null;
  avg_tone?: number | null;
  event_timestamp: string;
  global_event_id?: string | null;
  ai_processed: boolean;
  created_at: string;
}

export interface EventListResponse {
  total: number;
  limit: number;
  offset: number;
  events: EventItem[];
}

export interface GeoJSONGeometry {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONProperties {
  id: string;
  title: string;
  summary: string;
  category: EventCategory | string;
  severity: number;
  location_name: string | null;
  country_code: string | null;
  source_url: string;
  source_domain: string | null;
  key_actors: string[];
  event_timestamp: string;
  ai_processed: boolean;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: GeoJSONProperties;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface CategoryStat {
  category: string;
  count: number;
}

export interface SeverityStat {
  severity: number;
  count: number;
}

export interface CountryStat {
  country_code: string;
  count: number;
}

export interface DashboardStats {
  total_events: number;
  ai_processed_events: number;
  categories: CategoryStat[];
  severity_distribution: SeverityStat[];
  top_hotspots: CountryStat[];
  latest_event_time: string | null;
}

export interface HealthStatus {
  status: string;
  database: string;
  redis_connected: boolean;
  groq_configured: boolean;
  scheduler_mode: string;
}

export interface IngestLog {
  id: string | number;
  events_fetched?: number;
  events_saved?: number;
  ai_processed?: number;
  fetched_count?: number;
  saved_count?: number;
  ai_enriched_count?: number;
  status: string;
  details?: string | null;
  error_message?: string | null;
  timestamp?: string;
  created_at?: string;
}

export interface IngestStatusResponse {
  last_cycle: IngestLog | null;
  is_periodic_worker_active: boolean;
  groq_ai_active: boolean;
}

export interface FilterParams {
  category?: EventCategory | "all";
  minSeverity?: number;
  countryCode?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
