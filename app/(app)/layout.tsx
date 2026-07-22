"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RouteGuard, sessionAdapter } from "@/modules/auth"
import { BootstrapGate, bootstrapAdapter } from "@/modules/bootstrap"
import { SyncStatusContainer } from "@/modules/sync-status"
import { ErrorBoundary } from "@/shared/presentation/error-boundary"
import { getAccessToken } from "@/shared/infrastructure/auth-token-store"

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return ""
  return (
    window.__MARKET_DESKTOP_CONFIG__?.apiBaseUrl ??
    window.marketDesktop?.getConfig().apiBaseUrl ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
  )
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const token = getAccessToken() ?? undefined
  const apiBaseUrl = getApiBaseUrl() || undefined

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SyncStatusContainer />
        <RouteGuard port={sessionAdapter}>
          <BootstrapGate port={bootstrapAdapter} token={token} apiBaseUrl={apiBaseUrl}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </BootstrapGate>
        </RouteGuard>
      </SidebarInset>
    </SidebarProvider>
  )
}
