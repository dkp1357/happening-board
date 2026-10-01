"use client"

import React from "react"
import { EventCategory, EventItem, SeverityLevel } from "@/lib/types"
import { CATEGORY_CONFIG, SEVERITY_CONFIG, getCountryName, gdeltToIso } from "@/lib/constants"
import { formatFullDateTime, formatRelativeTime } from "@/lib/date"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  Users,
  Compass,
  Activity,
  Globe,
} from "lucide-react"

interface EventDetailDialogProps {
  event: EventItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLocateOnMap?: (event: EventItem) => void
}

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onLocateOnMap,
}: EventDetailDialogProps) {
  if (!event) return null

  const catConfig = CATEGORY_CONFIG[event.category as EventCategory] || CATEGORY_CONFIG.other
  const sevConfig = SEVERITY_CONFIG[event.severity as SeverityLevel] || SEVERITY_CONFIG[1]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[95vw] !max-w-[1400px] max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80"
      >
        {/* Header Section */}
        <div className="p-6 pb-4 bg-muted/20 border-b border-border/60">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Badge
              variant="outline"
              className={`text-xs font-semibold px-2.5 py-0.5 border ${catConfig.bgColor}`}
            >
              <span
                className="h-2 w-2 rounded-full mr-1.5 shrink-0"
                style={{ backgroundColor: catConfig.color }}
              />
              {catConfig.label}
            </Badge>

            <Badge
              variant="outline"
              className={`text-xs font-semibold px-2.5 py-0.5 border ${sevConfig.badgeColor}`}
            >
              Severity Level {event.severity} · {sevConfig.label}
            </Badge>

            {event.ai_processed ? (
              <Badge
                variant="outline"
                className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 px-2 py-0.5 flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Enriched Analysis</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground border-border px-2 py-0.5">
                Heuristic OSINT
              </Badge>
            )}
          </div>

          <DialogTitle className="text-xl font-bold text-foreground leading-snug tracking-tight">
            {event.title}
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground mt-2 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatRelativeTime(event.event_timestamp)} ({formatFullDateTime(event.event_timestamp)})</span>
            </span>
          </DialogDescription>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Situation Summary
            </h4>
            <p className="text-sm leading-relaxed text-foreground bg-muted/30 p-3.5 rounded-lg border border-border/60">
              {event.summary}
            </p>
          </div>

          {/* Location & Coordinates */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <span>Geographical Location</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/20 p-3.5 rounded-lg border border-border/60">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[10px]">Location</span>
                  <span className="font-medium text-foreground">
                    {event.location_name || "Unspecified"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[10px]">Country Code</span>
                  <span className="font-medium text-foreground">
                    {event.country_code
                      ? `${getCountryName(event.country_code)} (${gdeltToIso(event.country_code) ?? event.country_code})`
                      : "Global"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[10px]">Coordinates</span>
                  <span className="font-mono text-[11px] text-foreground">
                    {event.latitude?.toFixed(4)}°, {event.longitude?.toFixed(4)}°
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-[10px]">Severity Assessment</span>
                  <span className="font-medium text-foreground">
                    {sevConfig.description}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Actors */}
          {(event.actor1 || event.actor2 || (event.key_actors && event.key_actors.length > 0)) && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>Identified Actors & Entities</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {event.actor1 && (
                  <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1">
                    Actor 1: {event.actor1}
                  </Badge>
                )}
                {event.actor2 && (
                  <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1">
                    Actor 2: {event.actor2}
                  </Badge>
                )}
                {event.key_actors?.map((actor, idx) => (
                  <Badge key={idx} variant="outline" className="font-mono text-xs px-2 py-0.5">
                    {actor}
                  </Badge>
                ))}
              </div>
            </div>
          )}


          {/* Source Verification Link */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Primary Source & Verification
            </h4>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors">
              <div className="min-w-0 pr-3">
                <span className="text-xs font-medium text-foreground block truncate">
                  {event.source_domain || "Original News Source"}
                </span>
                <span className="text-[11px] text-muted-foreground truncate block font-mono">
                  {event.source_url}
                </span>
              </div>
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <span>Open Source</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
