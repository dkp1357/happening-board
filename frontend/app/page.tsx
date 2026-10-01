"use client"

import React, { useState } from "react"
import { useEvents } from "@/hooks/use-events"
import { useStats } from "@/hooks/use-stats"
import { EventCategory, EventItem } from "@/lib/types"
import { Navbar } from "@/components/navbar"
import { EventFeed } from "@/components/event-feed"
import { StatsPanel } from "@/components/stats-panel"
import { EventDetailDialog } from "@/components/event-detail-dialog"
import { IngestModal } from "@/components/ingest-modal"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"feed" | "analytics">("feed")
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [inspectEvent, setInspectEvent] = useState<EventItem | null>(null)
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false)

  // Events Hook
  const {
    events,
    total,
    isLoading: eventsLoading,
    isRefreshing: eventsRefreshing,
    error: eventsError,
    refresh: refreshEvents,
    category,
    setCategory,
    minSeverity,
    setMinSeverity,
    countryCode,
    setCountryCode,
    search,
    setSearch,
    resetFilters,
  } = useEvents({ autoRefreshInterval: 30000 })

  // Stats Hook
  const {
    stats,
    health,
    isLoading: statsLoading,
    refresh: refreshStats,
  } = useStats(45000)

  const handleSelectEvent = (event: EventItem) => {
    setSelectedEvent(event)
  }

  const handleInspectEvent = (event: EventItem) => {
    setInspectEvent(event)
  }

  const handleRefreshAll = () => {
    refreshEvents()
    refreshStats()
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Top Navbar */}
      <Navbar
        totalEvents={total}
        isRefreshing={eventsRefreshing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={handleRefreshAll}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col p-2.5 sm:p-4 max-w-[1920px] w-full mx-auto overflow-hidden">
        {/* Analytics Tab View */}
        {activeTab === "analytics" && (
          <div className="flex-1 overflow-y-auto max-w-6xl w-full mx-auto py-2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Global Conflict & OSINT Analytics
                </h2>
                <p className="text-xs text-muted-foreground">
                  Aggregated telemetry, severity spectrums, and geographical hotspot distribution.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setActiveTab("feed")}
              >
                Back to Feed
              </Button>
            </div>

            <StatsPanel
              stats={stats}
              health={health}
              isLoading={statsLoading}
              onSelectCategory={(cat: EventCategory) => {
                setCategory(cat)
                setActiveTab("feed")
              }}
              onSelectCountry={(cc: string) => {
                setCountryCode(cc)
                setActiveTab("feed")
              }}
            />
          </div>
        )}

        {/* Live Feed Tab View */}
        {activeTab === "feed" && (
          <div className="flex-1 h-[calc(100vh-8.5rem)] max-w-4xl w-full mx-auto">
            <EventFeed
              events={events}
              total={total}
              isLoading={eventsLoading}
              isRefreshing={eventsRefreshing}
              error={eventsError}
              selectedEvent={selectedEvent}
              category={category}
              minSeverity={minSeverity}
              countryCode={countryCode}
              search={search}
              onSelectEvent={handleSelectEvent}
              onInspectEvent={handleInspectEvent}
              onCategoryChange={setCategory}
              onMinSeverityChange={setMinSeverity}
              onCountryCodeChange={setCountryCode}
              onSearchChange={setSearch}
              onResetFilters={resetFilters}
              onRefresh={refreshEvents}
            />
          </div>
        )}
      </main>

      {/* Bottom Attribution Footer */}
      <footer className="border-t border-border/70 bg-card/40 backdrop-blur-xs px-4 py-2.5 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Happening Board</span>
          </span>
          <span className="hidden sm:inline text-border">·</span>
          <span>
            Data powered with gratitude to{" "}
            <a
              href="https://www.gdeltproject.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary underline underline-offset-2 transition-colors font-medium"
            >
              GDELT
            </a>
          </span>
          <span className="hidden sm:inline text-border">·</span>
          <span>
            Inspired by{" "}
            <a
              href="https://liveuamap.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary underline underline-offset-2 transition-colors font-medium"
            >
              Liveuamap
            </a>{" "}
            &amp;{" "}
            <a
              href="https://monitor-the-situation.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary underline underline-offset-2 transition-colors font-medium"
            >
              Monitor the Situation
            </a>
          </span>
        </div>
      </footer>

      {/* Modals */}
      <EventDetailDialog
        event={inspectEvent}
        open={!!inspectEvent}
        onOpenChange={(open) => {
          if (!open) setInspectEvent(null)
        }}
      />

      <IngestModal
        open={isIngestModalOpen}
        onOpenChange={setIsIngestModalOpen}
        health={health}
        onIngestSuccess={handleRefreshAll}
      />
    </div>
  )
}
