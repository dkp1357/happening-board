import {
  DashboardStats,
  EventItem,
  EventListResponse,
  FilterParams,
  GeoJSONFeatureCollection,
  HealthStatus,
  IngestStatusResponse,
} from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const X_API_KEY = process.env.NEXT_X_API_KEY || "api-key-ingest"

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options?.headers,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const errorText = await res.text()
      let parsedMessage = `Request failed with status ${res.status}`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.detail) parsedMessage = errorJson.detail
      } catch {
        // use default message
      }
      throw new Error(parsedMessage)
    }

    return await res.json()
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err
    }
    throw new Error("An unexpected network error occurred.")
  }
}

export async function fetchEvents(params: FilterParams = {}): Promise<EventListResponse> {
  const query = new URLSearchParams()
  if (params.category && params.category !== "all") query.set("category", params.category)
  if (params.minSeverity && params.minSeverity > 1) query.set("min_severity", params.minSeverity.toString())
  if (params.countryCode && params.countryCode !== "all") query.set("country_code", params.countryCode)
  if (params.search && params.search.trim().length > 0) query.set("search", params.search.trim())
  if (params.limit) query.set("limit", params.limit.toString())
  if (params.offset !== undefined) query.set("offset", params.offset.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ""
  return apiFetch<EventListResponse>(`/api/v1/events${queryString}`)
}

export async function fetchEventsGeoJSON(params: {
  category?: string
  minSeverity?: number
  countryCode?: string
  limit?: number
} = {}): Promise<GeoJSONFeatureCollection> {
  const query = new URLSearchParams()
  if (params.category && params.category !== "all") query.set("category", params.category)
  if (params.minSeverity && params.minSeverity > 1) query.set("min_severity", params.minSeverity.toString())
  if (params.countryCode && params.countryCode !== "all") query.set("country_code", params.countryCode)
  if (params.limit) query.set("limit", params.limit.toString())

  const queryString = query.toString() ? `?${query.toString()}` : ""
  return apiFetch<GeoJSONFeatureCollection>(`/api/v1/events/geojson${queryString}`)
}

export async function fetchEventDetail(id: string): Promise<EventItem> {
  return apiFetch<EventItem>(`/api/v1/events/${id}`)
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/api/v1/stats")
}

export async function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health")
}

export async function fetchIngestStatus(): Promise<IngestStatusResponse> {
  return apiFetch<IngestStatusResponse>("/api/v1/ingest/status")
}

export async function triggerIngest(
  apiKey: string = X_API_KEY,
  maxRecords: number = 50
): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(
    `/api/v1/ingest/trigger?max_records=${maxRecords}`,
    {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
      },
    }
  )
}
