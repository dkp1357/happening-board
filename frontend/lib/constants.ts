import { EventCategory, SeverityLevel } from "./types"
export { getCountryName, gdeltToIso, isoToGdelt } from "./country"

export const CATEGORY_CONFIG: Record<
  EventCategory,
  {
    label: string
    color: string
    bgColor: string
    borderColor: string
    darkBgColor: string
    textColor: string
    dotColor: string
  }
> = {
  military_conflict: {
    label: "Military Conflict",
    color: "#ef4444", // red-500
    bgColor: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900/50",
    borderColor: "border-red-500",
    darkBgColor: "bg-red-950",
    textColor: "text-red-600 dark:text-red-400",
    dotColor: "bg-red-500",
  },
  terror_security: {
    label: "Terror & Security",
    color: "#f97316", // orange-500
    bgColor: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-900/50",
    borderColor: "border-orange-500",
    darkBgColor: "bg-orange-950",
    textColor: "text-orange-600 dark:text-orange-400",
    dotColor: "bg-orange-500",
  },
  civil_unrest: {
    label: "Civil Unrest",
    color: "#eab308", // yellow-500
    bgColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
    borderColor: "border-amber-500",
    darkBgColor: "bg-amber-950",
    textColor: "text-amber-600 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  infrastructure_cyber: {
    label: "Cyber & Infra",
    color: "#a855f7", // purple-500
    bgColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900/50",
    borderColor: "border-purple-500",
    darkBgColor: "bg-purple-950",
    textColor: "text-purple-600 dark:text-purple-400",
    dotColor: "bg-purple-500",
  },
  diplomacy: {
    label: "Diplomacy",
    color: "#3b82f6", // blue-500
    bgColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
    borderColor: "border-blue-500",
    darkBgColor: "bg-blue-950",
    textColor: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  humanitarian: {
    label: "Humanitarian",
    color: "#10b981", // emerald-500
    bgColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
    borderColor: "border-emerald-500",
    darkBgColor: "bg-emerald-950",
    textColor: "text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  other: {
    label: "Other Event",
    color: "#6b7280", // gray-500
    bgColor: "bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800",
    borderColor: "border-zinc-500",
    darkBgColor: "bg-zinc-900",
    textColor: "text-zinc-600 dark:text-zinc-400",
    dotColor: "bg-zinc-500",
  },
}

export const SEVERITY_CONFIG: Record<
  SeverityLevel,
  {
    label: string
    badgeColor: string
    pulseColor: string
    dotColor: string
    description: string
  }
> = {
  1: {
    label: "Info",
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    pulseColor: "border-slate-400",
    dotColor: "bg-slate-400",
    description: "Routine diplomatic or minor report",
  },
  2: {
    label: "Low",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    pulseColor: "border-emerald-400",
    dotColor: "bg-emerald-500",
    description: "Minor protest or localized dispute",
  },
  3: {
    label: "Medium",
    badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    pulseColor: "border-amber-400",
    dotColor: "bg-amber-500",
    description: "Significant clash, border alert, notable unrest",
  },
  4: {
    label: "High",
    badgeColor: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    pulseColor: "border-orange-500",
    dotColor: "bg-orange-500",
    description: "Military strike, casualties, key offensive",
  },
  5: {
    label: "Critical",
    badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold",
    pulseColor: "border-rose-600 animate-ping",
    dotColor: "bg-rose-600",
    description: "Major invasion, strategic infrastructure destruction, WMD / mass casualty",
  },
}