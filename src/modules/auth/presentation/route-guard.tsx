"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import type { SessionPort } from "../application/session-port"

export interface RouteGuardProps {
  port: SessionPort
  children: React.ReactNode
}

export function RouteGuard({ port, children }: RouteGuardProps) {
  const router = useRouter()

  useEffect(() => {
    if (!port.currentUser()) {
      router.push("/login")
    }
  }, [port, router])

  return children
}
