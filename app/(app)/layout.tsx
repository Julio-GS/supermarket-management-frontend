"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RouteGuard, sessionAdapter } from "@/modules/auth"
import { BootstrapGate, bootstrapAdapter } from "@/modules/bootstrap"
import { SyncStatusContainer } from "@/modules/sync-status"
import { ErrorBoundary } from "@/shared/presentation/error-boundary"
import { getAccessToken } from "@/shared"
import { getAppApiBaseUrl } from "./runtime-api-url"

export default function AppLayout({ children }: { children: ReactNode }) {
  const token = getAccessToken() ?? undefined
  const apiBaseUrl = getAppApiBaseUrl() || undefined

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <RouteGuard port={sessionAdapter}>
          <BootstrapGate port={bootstrapAdapter} token={token} apiBaseUrl={apiBaseUrl}>
            <SyncStatusContainer token={token} apiBaseUrl={apiBaseUrl} />
            <ErrorBoundary>{children}</ErrorBoundary>
          </BootstrapGate>
        </RouteGuard>
      </SidebarInset>
    </SidebarProvider>
  )
}
