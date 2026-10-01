"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchDashboardStats, fetchHealth } from "@/lib/api"
import { DashboardStats, HealthStatus } from "@/lib/types"

export function useStats(refreshInterval: number = 45000) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const [statsData, healthData] = await Promise.all([
        fetchDashboardStats().catch(() => null),
        fetchHealth().catch(() => null),
      ])
      if (statsData) setStats(statsData)
      if (healthData) setHealth(healthData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load stats"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()

    if (refreshInterval > 0) {
      const timer = setInterval(loadStats, refreshInterval)
      return () => clearInterval(timer)
    }
  }, [loadStats, refreshInterval])

  return {
    stats,
    health,
    isLoading,
    error,
    refresh: loadStats,
  }
}
