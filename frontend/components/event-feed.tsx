"use client"

import React from "react"
import { EventCategory, EventItem } from "@/lib/types"
import { CATEGORY_CONFIG } from "@/lib/constants"
import { COUNTRY_NAMES } from "@/lib/country"
import { EventCard } from "./event-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  X,
  Filter,
  AlertCircle,
  RefreshCw,
} from "lucide-react"

interface EventFeedProps {
  events: EventItem[]
  total: number
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  selectedEvent: EventItem | null
  selectedLocation?: string | null
  onClearLocationFilter?: () => void
  category: EventCategory | "all"
  minSeverity: number
  countryCode: string
  search: string
  onSelectEvent: (event: EventItem) => void
  onInspectEvent: (event: EventItem) => void
  onCategoryChange: (cat: EventCategory | "all") => void
  onMinSeverityChange: (sev: number) => void
  onCountryCodeChange: (code: string) => void
  onSearchChange: (query: string) => void
  onResetFilters: () => void
  onRefresh: () => void
}

export function EventFeed({
  events,
  total,
  isLoading,
  isRefreshing,
  error,
  selectedEvent,
  selectedLocation,
  onClearLocationFilter,
  category,
  minSeverity,
  countryCode,
  search,
  onSelectEvent,
  onInspectEvent,
  onCategoryChange,
  onMinSeverityChange,
  onCountryCodeChange,
  onSearchChange,
  onResetFilters,
  onRefresh,
}: EventFeedProps) {
  const categoriesList: Array<{ id: EventCategory | "all"; label: string; color?: string }> = [
    { id: "all", label: "All Categories" },
    { id: "military_conflict", label: "Military", color: CATEGORY_CONFIG.military_conflict.color },
    { id: "terror_security", label: "Terror & Security", color: CATEGORY_CONFIG.terror_security.color },
    { id: "civil_unrest", label: "Civil Unrest", color: CATEGORY_CONFIG.civil_unrest.color },
    { id: "infrastructure_cyber", label: "Cyber & Infra", color: CATEGORY_CONFIG.infrastructure_cyber.color },
    { id: "diplomacy", label: "Diplomacy", color: CATEGORY_CONFIG.diplomacy.color },
    { id: "humanitarian", label: "Humanitarian", color: CATEGORY_CONFIG.humanitarian.color },
  ]

  const severityOptions: Array<{ level: number; label: string }> = [
    { level: 1, label: "All Severities" },
    { level: 2, label: "Low+ (L2-L5)" },
    { level: 3, label: "Medium+ (L3-L5)" },
    { level: 4, label: "High+ (L4-L5)" },
    { level: 5, label: "Critical Only (L5)" },
  ]

  const hasActiveFilters =
    category !== "all" || minSeverity > 1 || countryCode !== "all" || search.trim() !== ""

  return (
    <div className="flex flex-col h-full bg-background border border-border/70 rounded-xl overflow-hidden shadow-sm">
      {/* Search & Top Action Bar */}
      <div className="p-3.5 border-b border-border/70 bg-card/60 space-y-3">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events, locations, actors..."
            className="pl-9 pr-8 h-9 text-xs bg-background/80"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills (Horizontal scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {categoriesList.map((cat) => {
            const isActive = category === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/70"
                }`}
              >
                {cat.color && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: isActive ? "currentColor" : cat.color }}
                  />
                )}
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Secondary Filter Controls */}
        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Severity Filter */}
            <select
              value={minSeverity}
              onChange={(e) => onMinSeverityChange(Number(e.target.value))}
              className="h-7 px-2 text-xs rounded-md bg-background border border-border/70 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter by minimum severity"
            >
              {severityOptions.map((opt) => (
                <option key={opt.level} value={opt.level}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Country Filter */}
            <select
              value={countryCode}
              onChange={(e) => onCountryCodeChange(e.target.value)}
              className="h-7 px-2 text-xs rounded-md bg-background border border-border/70 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter by country"
            >
              <option value="all">All Countries</option>
              {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={onResetFilters}
              >
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
            <span className="font-semibold text-foreground">{total}</span>
            <span>Events</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={onRefresh}
              title="Refresh events feed"
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>


      {/* Feed List Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[300px]">
        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Unable to load events</span>
            </div>
            <p className="text-muted-foreground leading-normal">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-destructive/30 hover:bg-destructive/20 text-destructive cursor-pointer"
              onClick={onRefresh}
            >
              Retry Connection
            </Button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-border/60 bg-card/40 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && events.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
              <Filter className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">No events match your criteria</h4>
              <p className="text-xs max-w-[260px] mx-auto text-muted-foreground">
                {hasActiveFilters
                  ? "Try broadening your category, severity, or location filters."
                  : "No events are recorded yet. Trigger an ingestion cycle to fetch conflict data."}
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 cursor-pointer"
                onClick={onResetFilters}
              >
                Clear All Filters
              </Button>
            )}
          </div>
        )}

        {/* Event Cards */}
        {!isLoading &&
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onSelect={onSelectEvent}
              onInspect={onInspectEvent}
            />
          ))}
      </div>
    </div>
  )
}
