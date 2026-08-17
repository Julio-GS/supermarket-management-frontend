import {
  clearAccessToken,
  decodeJwt,
  getAccessToken,
  getStoredUsername,
  setAccessToken,
  storeUsername,
  clearStoredUsername,
} from "@/shared/infrastructure/auth-token-store"
import { resolveDesktopApiBaseUrlByNullish } from "@/shared/infrastructure/runtime-api-config"
import { err, ok } from "@/shared/domain/result"
import type { Result } from "@/shared/domain/result"
import type { SessionPort } from "../application/session-port"
import type { Credentials } from "../domain/credentials"
import type { AuthError } from "../domain/auth-error"
import type { Session } from "../domain/session"
import type { User, UserRole } from "../domain/user"

function normalizeRole(role: unknown): UserRole {
  if (role === "admin" || role === "cashier" || role === "manager") return role
  return "cashier"
}

function buildSessionFromToken(token: string, fallbackUsername: string | null): Session {
  const claims = decodeJwt(token)
  const username = claims?.username ?? claims?.sub ?? fallbackUsername ?? "unknown"
  return {
    user: {
      id: claims?.sub ?? username,
      username,
      email: claims?.email ?? "",
      name: claims?.name ?? username,
      role: normalizeRole(claims?.role),
    },
  }
}

function buildOfflineSession(userId: string, username: string): Session {
  return {
    user: {
      id: userId,
      username,
      email: "",
      name: username,
      role: "admin" as UserRole,
    },
  }
}

function mapDesktopError(error: string | undefined): AuthError {
  const msg = error ?? "Error de autenticacion"
  if (
    msg.toLowerCase().includes("incorrect") ||
    msg.toLowerCase().includes("no offline session") ||
    msg.toLowerCase().includes("invalid")
  ) {
    return { code: "INVALID_CREDENTIALS", message: msg }
  }
  return { code: "NETWORK_ERROR", message: msg }
}

/**
 * Desktop session adapter that delegates auth to the Electron main process
 * via the `window.marketDesktop.offline.login` IPC bridge.
 *
 * Strategy:
 *  1. Main process tries the backend first (8s timeout).
 *  2. On network error, main process falls back to local SQLite credential check.
 *  3. On success (online or offline), we store the token (if any) in localStorage.
 */
export function createDesktopSessionAdapter(): SessionPort {
  function getOfflineApi() {
    if (typeof window === "undefined" || !window.marketDesktop?.offline) {
      throw new Error("Desktop offline bridge is not available")
    }
    return window.marketDesktop.offline
  }

  function getApiBaseUrl(): string {
    return resolveDesktopApiBaseUrlByNullish() ?? "http://localhost:3001/api/v1"
  }

  return {
    async login(credentials: Credentials): Promise<Result<Session, AuthError>> {
      try {
        const api = getOfflineApi()
        const apiBaseUrl = getApiBaseUrl()

        const result = await api.login({
          username: credentials.username.trim(),
          password: credentials.password.trim(),
          apiBaseUrl,
        })

        if (!result.success) {
          return err(mapDesktopError(result.error))
        }

        const username = result.username ?? credentials.username.trim()
        storeUsername(username)

        if (result.token) {
          // Online login - store real JWT
          setAccessToken(result.token)
          return ok(buildSessionFromToken(result.token, username))
        }

        // Offline login - create a synthetic session marker in localStorage
        const offlineToken = `offline:${result.userId ?? "local"}:${username}`
        setAccessToken(offlineToken)
        return ok(buildOfflineSession(result.userId ?? `local:${username}`, username))
      } catch (error) {
        return err({
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Error de autenticacion",
        })
      }
    },

    async logout(): Promise<void> {
      clearAccessToken()
      clearStoredUsername()
    },

    currentUser(): User | null {
      const token = getAccessToken()
      if (!token) return null

      // Offline synthetic token
      if (token.startsWith("offline:")) {
        const parts = token.split(":")
        const username = parts[2] ?? getStoredUsername() ?? "unknown"
        const userId = parts[1] === "local" ? `local:${username}` : parts[1]
        return {
          id: userId,
          username,
          email: "",
          name: username,
          role: "admin" as UserRole,
        }
      }

      // Real JWT
      return buildSessionFromToken(token, getStoredUsername()).user
    },
  }
}

/**
 * Returns true when running inside the Electron shell with the offline bridge available.
 */
export function isDesktopSessionAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.offline !== undefined
}
