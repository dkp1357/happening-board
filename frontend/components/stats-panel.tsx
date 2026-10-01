"use client"

import React from "react"
import { DashboardStats, EventCategory, HealthStatus } from "@/lib/types"
import { CATEGORY_CONFIG, getCountryName, gdeltToIso } from "@/lib/constants"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Flame,
  Globe2,
  Cpu,
  Activity,
  Layers,
} from "lucide-react"

interface StatsPanelProps {
  stats: DashboardStats | null
  health?: HealthStatus | null
  isLoading: boolean
  onSelectCountry?: (countryCode: string) => void
  onSelectCategory?: (category: EventCategory) => void
}

export function StatsPanel({
  stats,
  health: _health,
  isLoading,
  onSelectCountry,
  onSelectCategory,
}: StatsPanelProps) {
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  // Calculate High + Critical threats
  const highCriticalCount = stats.severity_distribution
    .filter((s) => s.severity >= 4)
    .reduce((acc, curr) => acc + curr.count, 0)

  const aiPercentage = stats.total_events > 0
    ? Math.round((stats.ai_processed_events / stats.total_events) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Events */}
        <Card className="p-4 border-border/70 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Monitored Events</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {stats.total_events.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>GDELT 2.0 Data Source</span>
          </div>
        </Card>

        {/* High / Critical Threats */}
        <Card className="p-4 border-border/70 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Critical & High (L4-5)</span>
            <Flame className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {highCriticalCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {stats.total_events > 0
              ? `${Math.round((highCriticalCount / stats.total_events) * 100)}% of total volume`
              : "No active threats"}
          </div>
        </Card>

        {/* Active Hotspot Nations */}
        <Card className="p-4 border-border/70 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Active Hotspots</span>
            <Globe2 className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {stats.top_hotspots.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            {stats.top_hotspots.slice(0, 3).map((h) => gdeltToIso(h.country_code) ?? h.country_code).join(", ") || "Global"}
          </div>
        </Card>

        {/* AI Enrichment Ratio */}
        <Card className="p-4 border-border/70 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">AI Enrichment</span>
            <Cpu className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {aiPercentage}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {stats.ai_processed_events} AI verified & enriched
          </div>
        </Card>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Category Breakdown */}
        <Card className="p-4 border-border/70 bg-card/60 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Events by Category</span>
            </h4>
            <span className="text-xs text-muted-foreground">
              {stats.categories.length} Types
            </span>
          </div>

          <div className="space-y-2">
            {stats.categories.map((cat) => {
              const conf = CATEGORY_CONFIG[cat.category as EventCategory] || CATEGORY_CONFIG.other
              const percent = stats.total_events > 0
                ? Math.round((cat.count / stats.total_events) * 100)
                : 0

              return (
                <div
                  key={cat.category}
                  className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onSelectCategory && onSelectCategory(cat.category as EventCategory)}
                  title={`Filter by ${conf.label}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: conf.color }}
                      />
                      <span>{conf.label}</span>
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {cat.count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: conf.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Hotspots Ranking & Server Health */}
        <div className="space-y-3">
          <Card className="p-4 border-border/70 bg-card/60 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5" />
                <span>Top Conflict Hotspots</span>
              </h4>
              <span className="text-xs text-muted-foreground">Volume</span>
            </div>

            <div className="space-y-1.5">
              {stats.top_hotspots.slice(0, 10).map((hotspot, idx) => {
                const isoCode = gdeltToIso(hotspot.country_code) ?? hotspot.country_code
                return (
                  <div
                    key={hotspot.country_code}
                    onClick={() => onSelectCountry && onSelectCountry(isoCode)}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors text-xs"
                    title={`Filter events in ${getCountryName(hotspot.country_code)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-muted-foreground w-4">
                        #{idx + 1}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {isoCode}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {getCountryName(hotspot.country_code)}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-foreground">
                      {hotspot.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
