import { createApiSessionAdapter } from "./api-session-adapter"
import { createDesktopSessionAdapter, isDesktopSessionAvailable } from "./desktop-session-adapter"

/**
 * Singleton session adapter.
 *
 * - In Electron (desktop), delegates auth to the main process via IPC so
 *   login works offline using credentials stored in the local SQLite DB.
 * - In browser/dev mode, uses the regular backend API adapter.
 */
export const sessionAdapter = isDesktopSessionAvailable()
  ? createDesktopSessionAdapter()
  : createApiSessionAdapter()
