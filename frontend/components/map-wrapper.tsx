"use client"

import dynamic from "next/dynamic"
import { EventItem, GeoJSONFeatureCollection } from "@/lib/types"

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[350px] rounded-xl border border-border/80 flex flex-col items-center justify-center bg-muted/20 gap-3 p-6">
      <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-xs text-muted-foreground font-medium">
        Loading Global Conflict Map & Spatial Layers...
      </span>
    </div>
  ),
})

interface MapWrapperProps {
  events: EventItem[]
  geoJSON?: GeoJSONFeatureCollection | null
  selectedEvent: EventItem | null
  onSelectEvent: (event: EventItem) => void
  onInspectEvent: (event: EventItem) => void
  onViewLocationFeed?: (event: EventItem) => void
}

export function MapWrapper(props: MapWrapperProps) {
  return <MapView {...props} />
}
