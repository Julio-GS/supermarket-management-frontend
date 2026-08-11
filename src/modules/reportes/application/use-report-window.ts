"use client"

import { useCallback, useState } from "react"
import type { FixedReportWindow, ReportQuery } from "../domain/report-read-models"

export interface UseReportWindowResult {
  query: ReportQuery
  setQuery: (q: ReportQuery) => void
}

const STORAGE_KEY = "report-window"
const VALID_FIXED: FixedReportWindow[] = ["day", "week", "month"]

function isValidFixed(value: unknown): value is FixedReportWindow {
  return typeof value === "string" && (VALID_FIXED as string[]).includes(value)
}

function readStoredQuery(): ReportQuery {
  if (typeof window === "undefined") return { kind: "fixed", window: "day" }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Legacy storage: plain window string
      if (typeof parsed === "string" && isValidFixed(parsed)) {
        return { kind: "fixed", window: parsed }
      }
      // New storage: ReportQuery object
      if (parsed && typeof parsed === "object" && parsed.kind === "fixed" && isValidFixed(parsed.window)) {
        return { kind: "fixed", window: parsed.window }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { kind: "fixed", window: "day" }
}

export function useReportWindow(): UseReportWindowResult {
  const [query, setQueryState] = useState<ReportQuery>(readStoredQuery)

  const setQuery = useCallback((q: ReportQuery) => {
    setQueryState(q)
    try {
      // Only persist fixed windows to avoid leaking date selections across sessions
      if (q.kind === "fixed") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(q))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  return { query, setQuery }
}
