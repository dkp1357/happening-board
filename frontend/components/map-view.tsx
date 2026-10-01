"use client"

import React, { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet"
import { EventCategory, EventItem, GeoJSONFeatureCollection } from "@/lib/types"
import { CATEGORY_CONFIG, SEVERITY_CONFIG, getCountryName } from "@/lib/constants"
import { Maximize2, Layers, MapPin, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const INDIA_CENTER: [number, number] = [22.0, 79.0]
const INDIA_ZOOM = 5

interface MapViewProps {
  events: EventItem[]
  geoJSON?: GeoJSONFeatureCollection | null
  selectedEvent: EventItem | null
  onSelectEvent: (event: EventItem) => void
  onInspectEvent: (event: EventItem) => void
  onViewLocationFeed?: (event: EventItem) => void
}

export default function MapView({
  events,
  selectedEvent,
  onSelectEvent,
  onInspectEvent,
  onViewLocationFeed,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const markersLayerRef = useRef<LayerGroup | null>(null)
  const tileLayerRef = useRef<TileLayer | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null)

  // Initialize Map with OpenStreetMap centered on India
  useEffect(() => {
    let isMounted = true

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return
      const L = (await import("leaflet")).default

      if (mapInstanceRef.current) return

      // Default center: India
      const map = L.map(mapContainerRef.current, {
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
      })

      // Add zoom control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map)

      // OpenStreetMap standard tile layer
      const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      const tiles = L.tileLayer(tileUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      tileLayerRef.current = tiles

      const markersGroup = L.layerGroup().addTo(map)
      markersLayerRef.current = markersGroup
      mapInstanceRef.current = map

      // Invalidate map size so it fits perfectly on load
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      }, 100)

      if (isMounted) {
        setMapReady(true)
      }
    }

    initMap()

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    }
    window.addEventListener("resize", handleResize)

    return () => {
      isMounted = false
      window.removeEventListener("resize", handleResize)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Render Markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) return

    import("leaflet").then((L) => {
      if (!markersLayerRef.current) return
      markersLayerRef.current.clearLayers()

      events.forEach((ev) => {
        if (!ev.latitude || !ev.longitude) return

        const catConfig = CATEGORY_CONFIG[ev.category as EventCategory] || CATEGORY_CONFIG.other
        const sevConfig = SEVERITY_CONFIG[ev.severity as 1 | 2 | 3 | 4 | 5] || SEVERITY_CONFIG[1]

        const isSelected = selectedEvent?.id === ev.id ||
          (Boolean(selectedEvent?.location_name) && selectedEvent?.location_name === ev.location_name)

        const isCritical = ev.severity >= 4
        const markerSize = isSelected ? 30 : isCritical ? 24 : 20
        const dotSize = isSelected ? 12 : isCritical ? 10 : 8

        // High-visibility marker with large touch target for mobile/desktop
        const html = `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${markerSize + 10}px; height: ${markerSize + 10}px;" title="${ev.title}">
            ${
              isSelected
                ? `<span class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style="background-color: ${catConfig.color};"></span>
                   <span class="absolute inline-flex rounded-full ring-4 ring-primary ring-offset-2 ring-offset-background shadow-lg" style="width: ${markerSize}px; height: ${markerSize}px; background-color: ${catConfig.color};"></span>`
                : isCritical
                ? `<span class="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style="background-color: ${catConfig.color};"></span>
                   <span class="relative inline-flex rounded-full shadow-md transition-transform transform group-hover:scale-125 duration-150 border-2 border-white dark:border-zinc-950 items-center justify-center" 
                         style="width: ${markerSize}px; height: ${markerSize}px; background-color: ${catConfig.color};">
                   </span>`
                : `<span class="relative inline-flex rounded-full shadow-md transition-transform transform group-hover:scale-125 duration-150 border-2 border-white dark:border-zinc-950 items-center justify-center" 
                         style="width: ${markerSize}px; height: ${markerSize}px; background-color: ${catConfig.color};">
                   </span>`
            }
            <span class="absolute rounded-full bg-white dark:bg-zinc-950 shadow-xs" style="width: ${dotSize}px; height: ${dotSize}px;"></span>
          </div>
        `

        const customIcon = L.divIcon({
          html,
          className: "custom-div-icon",
          iconSize: [markerSize + 10, markerSize + 10],
          iconAnchor: [(markerSize + 10) / 2, (markerSize + 10) / 2],
          popupAnchor: [0, -(markerSize + 10) / 2 - 4],
        })

        const marker = L.marker([ev.latitude, ev.longitude], { icon: customIcon })

        if (isSelected) {
          marker.setZIndexOffset(1000)
        }

        // Count other events at this location
        const sameLocationCount = events.filter(
          (e) => (e.location_name && e.location_name === ev.location_name) ||
                 (Math.abs(e.latitude - ev.latitude) < 0.05 && Math.abs(e.longitude - ev.longitude) < 0.05)
        ).length

        // Rich Popup Content
        const popupDiv = document.createElement("div")
        popupDiv.className = "p-3.5 space-y-2.5 max-w-[290px]"
        popupDiv.innerHTML = `
          <div class="flex items-center justify-between gap-1.5 border-b border-border/50 pb-2">
            <span class="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full" style="background-color: ${catConfig.color}20; color: ${catConfig.color}; border: 1px solid ${catConfig.color}50;">
              ${catConfig.label}
            </span>
            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded ${sevConfig.badgeColor}">
              Sev ${ev.severity}: ${sevConfig.label}
            </span>
          </div>
          <div>
            <h4 class="text-sm font-semibold text-foreground line-clamp-2 leading-snug">${ev.title}</h4>
            <p class="text-xs text-muted-foreground mt-1 line-clamp-2">${ev.summary}</p>
          </div>
          <div class="text-[11px] text-muted-foreground pt-1 border-t border-border/40 flex items-center justify-between">
            <span class="truncate mr-2 font-medium">📍 ${ev.location_name || getCountryName(ev.country_code)}</span>
            <span class="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">${sameLocationCount} incident${sameLocationCount === 1 ? '' : 's'}</span>
          </div>
          <div class="flex items-center justify-between gap-2 pt-1">
            <button id="btn-feed-${ev.id}" class="text-xs bg-primary text-primary-foreground font-medium px-2.5 py-1 rounded hover:opacity-90 flex items-center gap-1 cursor-pointer">
              <span>View Feed</span>
              <span>&rarr;</span>
            </button>
            <button id="btn-inspect-${ev.id}" class="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded hover:bg-muted cursor-pointer">
              Details
            </button>
          </div>
        `

        marker.bindPopup(popupDiv, {
          className: "custom-map-popup",
          closeButton: true,
          autoPan: true,
        })

        // Click / Tap Handler
        marker.on("click", () => {
          setDismissedEventId(null)
          onSelectEvent(ev)
        })

        marker.on("popupopen", () => {
          const btnInspect = document.getElementById(`btn-inspect-${ev.id}`)
          if (btnInspect) {
            btnInspect.onclick = (e) => {
              e.preventDefault()
              e.stopPropagation()
              onInspectEvent(ev)
            }
          }

          const btnFeed = document.getElementById(`btn-feed-${ev.id}`)
          if (btnFeed) {
            btnFeed.onclick = (e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onViewLocationFeed) {
                onViewLocationFeed(ev)
              } else {
                onSelectEvent(ev)
              }
            }
          }
        })

        if (markersLayerRef.current) {
          markersLayerRef.current.addLayer(marker)
        }
      })
    })
  }, [events, mapReady, selectedEvent, onSelectEvent, onInspectEvent, onViewLocationFeed])

  // Center on Selected Event when selected
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedEvent) return
    if (selectedEvent.latitude && selectedEvent.longitude) {
      mapInstanceRef.current.flyTo([selectedEvent.latitude, selectedEvent.longitude], 7, {
        duration: 1.0,
      })
    }
  }, [selectedEvent, mapReady])

  const handleResetToIndia = () => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.flyTo(INDIA_CENTER, INDIA_ZOOM, { duration: 1.2 })
  }

  return (
    <div className="relative w-full h-full min-h-[350px] overflow-hidden rounded-xl border border-border/80 shadow-sm bg-muted/30">
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" tabIndex={0} aria-label="Interactive conflict events map" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2">
        <Badge
          variant="secondary"
          className="backdrop-blur-md bg-background/85 border border-border/70 text-foreground px-2.5 py-1 text-xs font-medium shadow-sm flex items-center gap-1.5"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{events.length} Events on Map</span>
        </Badge>
      </div>

      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2.5 backdrop-blur-md bg-background/85 hover:bg-background border border-border/70 text-xs shadow-sm cursor-pointer"
          onClick={handleResetToIndia}
          title="Reset map view to India"
        >
          <Maximize2 className="h-3.5 w-3.5 mr-1" />
          <span>Reset to India</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2.5 backdrop-blur-md bg-background/85 hover:bg-background border border-border/70 text-xs shadow-sm cursor-pointer"
          onClick={() => setShowLegend(!showLegend)}
          title="Toggle Map Legend"
        >
          <Layers className="h-3.5 w-3.5 mr-1" />
          <span>Legend</span>
        </Button>
      </div>

      {/* Floating Selected Pin Banner on Mobile / Touch */}
      {selectedEvent && selectedEvent.id !== dismissedEventId && (
        <div className="lg:hidden absolute bottom-3 left-3 right-3 z-[400] p-3 rounded-lg backdrop-blur-md bg-background/95 border border-primary/40 shadow-xl text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground truncate">
                {selectedEvent.location_name || getCountryName(selectedEvent.country_code)}
              </span>
            </div>
            <button
              onClick={() => setDismissedEventId(selectedEvent.id)}
              className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              aria-label="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{selectedEvent.title}</p>
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              className="h-7 text-xs flex-1 bg-primary text-primary-foreground font-medium"
              onClick={() => {
                if (onViewLocationFeed) {
                  onViewLocationFeed(selectedEvent)
                }
              }}
            >
              <span>View Location Feed</span>
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onInspectEvent(selectedEvent)}
            >
              Details
            </Button>
          </div>
        </div>
      )}

      {/* Floating Legend Overlay */}
      {showLegend && (
        <div className="absolute bottom-12 left-3 z-[400] p-3 rounded-lg backdrop-blur-md bg-background/95 border border-border/80 shadow-lg text-xs w-60 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
            <span className="font-semibold text-foreground">Conflict Categories</span>
            <button
              onClick={() => setShowLegend(false)}
              className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
            >
              &times;
            </button>
          </div>
          <div className="space-y-1.5">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{config.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-border/60">
            <span className="font-semibold text-foreground block mb-1">Severity Levels</span>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span>1 Info</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>3 Med</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                <span>5 Critical</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
