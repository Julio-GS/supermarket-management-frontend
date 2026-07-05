"use client"

import { useCallback, useEffect, useState } from "react"
import type { ReportWindow } from "../domain/report-read-models"

export interface UseReportWindowResult {
  window: ReportWindow
  setWindow: (w: ReportWindow) => void
}

const STORAGE_KEY = "report-window"
const VALID_WINDOWS: ReportWindow[] = ["day", "week", "month"]

function isValidWindow(value: unknown): value is ReportWindow {
  return typeof value === "string" && (VALID_WINDOWS as string[]).includes(value)
}

function readStoredWindow(): ReportWindow {
  if (typeof window === "undefined") return "day"
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isValidWindow(JSON.parse(raw))) {
      return JSON.parse(raw) as ReportWindow
    }
  } catch {
    // Ignore parse errors
  }
  return "day"
}

export function useReportWindow(): UseReportWindowResult {
  const [window, setWindowState] = useState<ReportWindow>(readStoredWindow)

  // Sync from localStorage on mount (SSR-safe)
  useEffect(() => {
    setWindowState(readStoredWindow())
  }, [])

  const setWindow = useCallback((w: ReportWindow) => {
    setWindowState(w)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(w))
    } catch {
      // Ignore storage errors
    }
  }, [])

  return { window, setWindow }
}
