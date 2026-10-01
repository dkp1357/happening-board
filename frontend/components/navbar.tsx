"use client"

import React from "react"
import { ThemeToggle } from "./theme-toggle"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Radio,
  RefreshCw,
  ListFilter,
  BarChart3,
} from "lucide-react"

interface NavbarProps {
  totalEvents: number
  isRefreshing: boolean
  activeTab: "feed" | "analytics"
  onTabChange: (tab: "feed" | "analytics") => void
  onRefresh: () => void
}

export function Navbar({
  totalEvents,
  isRefreshing,
  activeTab,
  onTabChange,
  onRefresh,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between px-3 sm:px-6">
        {/* Brand & Live Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Radio className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wider uppercase text-foreground">
                  Happening Board
                </span>
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex text-[10px] tracking-widest uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300/60 font-medium px-1.5 py-0 items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Updated Every 15 minutes</span>
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground hidden md:block">
                {totalEvents > 0 ? `${totalEvents} events tracked` : "Conflict intelligence monitor"}
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/70 text-xs">
          <button
            onClick={() => onTabChange("feed")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${activeTab === "feed"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Feed</span>
          </button>

          <button
            onClick={() => onTabChange("analytics")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${activeTab === "analytics"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Analytics</span>
          </button>
        </div>

        {/* Right Tools: Ingestion & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border/80 cursor-pointer"
            title="Refresh active feeds"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
            <span className="hidden sm:inline ml-1.5">Refresh</span>
          </Button>

          {/* Light / Dark Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
