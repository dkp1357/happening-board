import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Happening Board - OSINT & Conflict Monitor",
  description:
    "Situational intelligence and conflict monitoring dashboard tracking geopolitical events, military actions, and security alerts worldwide.",
  keywords: [
    "OSINT",
    "conflict monitoring",
    "geopolitics",
    "GDELT",
    "situation map",
    "defense intelligence",
  ],
  authors: [{ name: "Happening Board Intelligence" }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={150}>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
