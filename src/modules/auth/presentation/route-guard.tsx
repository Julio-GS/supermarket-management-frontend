"use client"

import { redirect } from "next/navigation"
import type { SessionPort } from "../application/session-port"

export interface RouteGuardProps {
  port: SessionPort
  children: React.ReactNode
}

export function RouteGuard({ port, children }: RouteGuardProps) {
  if (!port.currentUser()) {
    redirect("/login")
  }

  return children
}
