"use client"

import React from "react"
import { EventCategory, EventItem, SeverityLevel } from "@/lib/types"
import { CATEGORY_CONFIG, SEVERITY_CONFIG, getCountryName, gdeltToIso } from "@/lib/constants"
import { formatRelativeTime } from "@/lib/date"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  MapPin,
  Sparkles,
  Clock,
} from "lucide-react"

interface EventCardProps {
  event: EventItem
  isSelected: boolean
  onSelect: (event: EventItem) => void
  onInspect: (event: EventItem) => void
}

export function EventCard({
  event,
  isSelected,
  onSelect,
  onInspect,
}: EventCardProps) {
  const catConfig = CATEGORY_CONFIG[event.category as EventCategory] || CATEGORY_CONFIG.other
  const sevConfig = SEVERITY_CONFIG[event.severity as SeverityLevel] || SEVERITY_CONFIG[1]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onInspect(event)
    }
  }

  return (
    <Card
      id={`event-card-${event.id}`}
      tabIndex={0}
      role="button"
      aria-label={`Event: ${event.title}`}
      onKeyDown={handleKeyDown}
      onClick={() => onSelect(event)}
      className={`group relative text-left transition-all duration-150 p-4 cursor-pointer hover:shadow-md border ${
        isSelected
          ? "border-primary ring-2 ring-primary/40 bg-primary/5 dark:bg-primary/10 shadow-md"
          : "border-border/70 hover:border-border bg-card"
      }`}
    >
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[11px] font-medium px-2 py-0.5 border ${catConfig.bgColor}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full mr-1.5 shrink-0"
              style={{ backgroundColor: catConfig.color }}
            />
            {catConfig.label}
          </Badge>

          <Badge
            variant="outline"
            className={`text-[11px] font-medium px-2 py-0.5 border ${sevConfig.badgeColor}`}
          >
            L{event.severity} · {sevConfig.label}
          </Badge>


          {event.ai_processed && (
            <Badge
              variant="outline"
              className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 px-1.5 py-0.5 flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              <span>AI Enriched</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(event.event_timestamp)}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-1.5 line-clamp-2">
        {event.title}
      </h3>

      {/* Summary Snippet */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
        {event.summary}
      </p>

      {/* Key Actors / Entities */}
      {event.key_actors && event.key_actors.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {event.key_actors.slice(0, 3).map((actor, idx) => (
            <span
              key={idx}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
            >
              {actor}
            </span>
          ))}
          {event.key_actors.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{event.key_actors.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer Info & Actions */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground truncate mr-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate">
            {event.location_name || getCountryName(event.country_code)}
          </span>
          {event.country_code && (
            <span className="text-[10px] uppercase font-mono px-1 rounded bg-muted">
              {gdeltToIso(event.country_code) ?? event.country_code}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation()
              onInspect(event)
            }}
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  )
}
