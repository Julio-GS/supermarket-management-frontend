"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RouteGuard, sessionAdapter } from "@/modules/auth"
import { ErrorBoundary } from "@/shared/presentation/error-boundary"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <RouteGuard port={sessionAdapter}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </RouteGuard>
      </SidebarInset>
    </SidebarProvider>
  )
}
