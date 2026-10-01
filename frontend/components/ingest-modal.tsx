"use client"

import React, { useCallback, useEffect, useState } from "react"
import { fetchIngestStatus, triggerIngest } from "@/lib/api"
import { HealthStatus, IngestStatusResponse } from "@/lib/types"
import { formatFullDateTime } from "@/lib/date"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Database,
  Server,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Cpu,
} from "lucide-react"

interface IngestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  health: HealthStatus | null
  onIngestSuccess?: () => void
}

export function IngestModal({
  open,
  onOpenChange,
  health,
  onIngestSuccess,
}: IngestModalProps) {
  const [apiKey, setApiKey] = useState("")
  const [maxRecords, setMaxRecords] = useState(50)
  const [isTriggering, setIsTriggering] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null)
  const [statusData, setStatusData] = useState<IngestStatusResponse | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true)
    try {
      const data = await fetchIngestStatus()
      setStatusData(data)
    } catch {
      // ignore
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

  // Load status whenever opened
  useEffect(() => {
    if (open) {
      loadStatus()
    }
  }, [open, loadStatus])

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    setIsTriggering(true)
    setTriggerResult(null)

    try {
      const res = await triggerIngest(apiKey.trim(), maxRecords)
      setTriggerResult({
        success: true,
        message: res.message || "Ingestion successfully initiated.",
      })
      setTimeout(() => {
        loadStatus()
        if (onIngestSuccess) onIngestSuccess()
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to trigger ingestion"
      setTriggerResult({
        success: false,
        message: msg,
      })
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 border-border/80">
        <div className="p-5 bg-muted/20 border-b border-border/60">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <span>System Status &amp; Ingestion</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Monitor system status and trigger conflict feed ingestion.
          </DialogDescription>
        </div>

        <div className="p-5 space-y-5 text-xs">
          {/* Health Status Matrix */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
              <span>Service Status</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={loadStatus}
                disabled={isLoadingStatus}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingStatus ? "animate-spin" : ""}`} />
                Check Status
              </Button>
            </h4>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-foreground">Database Store</span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Connected
                </Badge>
              </div>

              <div className="p-2.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-foreground">Cache Layer</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    health?.redis_connected !== false
                      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "text-rose-500 border-rose-500/30"
                  }`}
                >
                  {health?.redis_connected !== false ? "Active" : "Offline"}
                </Badge>
              </div>

              <div className="p-2.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple-500" />
                  <span className="font-medium text-foreground">AI Engine</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    health?.groq_configured
                      ? "text-purple-600 dark:text-purple-400 border-purple-500/30"
                      : "text-muted-foreground border-border"
                  }`}
                >
                  {health?.groq_configured ? "Active" : "Heuristic"}
                </Badge>
              </div>

              <div className="p-2.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-500" />
                  <span className="font-medium text-foreground">Scheduler</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                  {health?.scheduler_mode || "External"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Last Ingestion Log */}
          {statusData?.last_cycle && (
            <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Last Ingestion Cycle
              </span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium uppercase text-emerald-600 dark:text-emerald-400">
                  {statusData.last_cycle.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Records Processed:</span>
                <span className="font-mono font-medium text-foreground">
                  {statusData.last_cycle.events_fetched ?? statusData.last_cycle.fetched_count ?? 0} fetched / {statusData.last_cycle.events_saved ?? statusData.last_cycle.saved_count ?? 0} saved
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">AI Enriched:</span>
                <span className="font-mono font-medium text-purple-600 dark:text-purple-400">
                  {statusData.last_cycle.ai_processed ?? statusData.last_cycle.ai_enriched_count ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Executed:</span>
                <span className="text-muted-foreground">
                  {formatFullDateTime(statusData.last_cycle.timestamp ?? statusData.last_cycle.created_at ?? "")}
                </span>
              </div>
              {statusData.last_cycle.details && (
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40 truncate">
                  {statusData.last_cycle.details}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Manual Trigger Form */}
          <form onSubmit={handleTrigger} className="space-y-3">
            <div>
              <label className="font-semibold text-foreground text-xs block mb-1">
                Manual Feed Ingestion
              </label>
              <p className="text-muted-foreground text-[11px] mb-2.5">
                Fetches latest global conflict events and runs deduplication & AI synthesis.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter X-API-Key (e.g. hb_secret_ingest_key_change_me_in_prod)"
                  className="pl-8 text-xs h-9"
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Max records to process:</span>
                <select
                  value={maxRecords}
                  onChange={(e) => setMaxRecords(Number(e.target.value))}
                  className="h-8 px-2 text-xs rounded bg-background border border-border/70 text-foreground"
                >
                  <option value={20}>20 records (Fast)</option>
                  <option value={50}>50 records (Standard)</option>
                  <option value={100}>100 records (Deep)</option>
                </select>
              </div>
            </div>

            {triggerResult && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                  triggerResult.success
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300"
                    : "bg-destructive/10 text-destructive border-destructive/30"
                }`}
              >
                {triggerResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span>{triggerResult.message}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isTriggering || !apiKey.trim()}
              className="w-full text-xs h-9 mt-1"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  <span>Syncing Feeds...</span>
                </>
              ) : (
                <span>Trigger Feed Ingestion</span>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
