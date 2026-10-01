"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const subscribe = () => () => {}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <div className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border/80 opacity-50">
        <Sun className="h-4 w-4" />
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-9 w-9 inline-flex items-center justify-center relative rounded-md border border-border/80 hover:bg-muted focus-visible:ring-1 focus-visible:outline-none transition-colors cursor-pointer bg-background"
        aria-label="Select theme"
      >
        <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
        <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-sky-400" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 z-50">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`flex items-center gap-2 cursor-pointer ${theme === "light" ? "font-semibold" : ""}`}
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-2 cursor-pointer ${theme === "dark" ? "font-semibold" : ""}`}
        >
          <Moon className="h-4 w-4 text-sky-400" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`flex items-center gap-2 cursor-pointer ${theme === "system" ? "font-semibold" : ""}`}
        >
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
