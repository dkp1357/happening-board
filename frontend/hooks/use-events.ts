"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchEvents, fetchEventsGeoJSON } from "@/lib/api"
import { EventCategory, EventItem, FilterParams, GeoJSONFeatureCollection } from "@/lib/types"
import { isoToGdelt } from "@/lib/country"

interface UseEventsOptions {
  autoRefreshInterval?: number // ms, 0 means disabled
}

export function useEvents(options: UseEventsOptions = { autoRefreshInterval: 30000 }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [geoJSON, setGeoJSON] = useState<GeoJSONFeatureCollection | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [category, setCategory] = useState<EventCategory | "all">("all")
  const [minSeverity, setMinSeverity] = useState<number>(1)
  const [countryCode, setCountryCode] = useState<string>("all")
  const [search, setSearch] = useState<string>("")
  const [limit, setLimit] = useState<number>(50)
  const [offset, setOffset] = useState<number>(0)

  const loadData = useCallback(
    async (isBackground: boolean = false) => {
      if (!isBackground) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }
      setError(null)

      const filterParams: FilterParams = {
        category: category !== "all" ? category : undefined,
        minSeverity: minSeverity > 1 ? minSeverity : undefined,
        // Convert ISO code (used in UI) to GDELT/FIPS before sending to backend
        countryCode: countryCode !== "all" ? (isoToGdelt(countryCode) ?? countryCode) : undefined,
        search: search.trim() ? search.trim() : undefined,
        limit,
        offset,
      }

      try {
        const [eventRes, geoRes] = await Promise.all([
          fetchEvents(filterParams),
          fetchEventsGeoJSON({
            category: category !== "all" ? category : undefined,
            minSeverity: minSeverity > 1 ? minSeverity : undefined,
            // Convert ISO code (used in UI) to GDELT/FIPS before sending to backend
            countryCode: countryCode !== "all" ? (isoToGdelt(countryCode) ?? countryCode) : undefined,
            limit: 200,
          }).catch((err) => {
            console.warn("GeoJSON fetch warning:", err)
            return null
          }),
        ])

        setEvents(eventRes.events)
        setTotal(eventRes.total)
        if (geoRes) {
          setGeoJSON(geoRes)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load events"
        setError(message)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [category, minSeverity, countryCode, search, limit, offset]
  )

  // Fetch when filters change
  useEffect(() => {
    loadData(false)
  }, [loadData])

  // Periodic auto-refresh
  useEffect(() => {
    if (!options.autoRefreshInterval || options.autoRefreshInterval <= 0) return

    const intervalId = setInterval(() => {
      loadData(true)
    }, options.autoRefreshInterval)

    return () => clearInterval(intervalId)
  }, [loadData, options.autoRefreshInterval])

  const resetFilters = useCallback(() => {
    setCategory("all")
    setMinSeverity(1)
    setCountryCode("all")
    setSearch("")
    setOffset(0)
  }, [])

  return {
    events,
    geoJSON,
    total,
    isLoading,
    isRefreshing,
    error,
    refresh: () => loadData(false),
    // Filter controls
    category,
    setCategory: (c: EventCategory | "all") => {
      setCategory(c)
      setOffset(0)
    },
    minSeverity,
    setMinSeverity: (s: number) => {
      setMinSeverity(s)
      setOffset(0)
    },
    countryCode,
    setCountryCode: (cc: string) => {
      setCountryCode(cc)
      setOffset(0)
    },
    search,
    setSearch: (s: string) => {
      setSearch(s)
      setOffset(0)
    },
    limit,
    setLimit,
    offset,
    setOffset,
    resetFilters,
  }
}
