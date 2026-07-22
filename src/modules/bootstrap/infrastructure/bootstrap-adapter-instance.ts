import type { BootstrapPort } from "../application/bootstrap-port"
import { createDesktopBootstrapAdapter } from "./desktop-bootstrap-adapter"
import { createWebBootstrapAdapter } from "./web-bootstrap-adapter"

function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.bootstrap !== undefined
}

/**
 * Singleton bootstrap adapter instance.
 *
 * Uses the desktop IPC bridge when running inside Electron; falls back to
 * a web adapter that always returns `complete` in browser/dev mode.
 */
export const bootstrapAdapter: BootstrapPort = isDesktopShell()
  ? createDesktopBootstrapAdapter()
  : createWebBootstrapAdapter()
