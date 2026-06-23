import { apiRequest, BackendRequestError } from "@/shared/infrastructure/api-client"
import {
  clearAccessToken,
  clearStoredUsername,
  decodeJwt,
  getAccessToken,
  getStoredUsername,
  setAccessToken,
  storeUsername,
  type JwtPayload,
} from "@/shared/infrastructure/auth-token-store"
import { err, ok } from "@/shared/domain/result"
import type { Result } from "@/shared/domain/result"
import type { SessionPort } from "../application/session-port"
import type { Credentials } from "../domain/credentials"
import type { AuthError } from "../domain/auth-error"
import type { Session } from "../domain/session"
import type { User, UserRole } from "../domain/user"

interface LoginRequestDto {
  username: string
  password: string
}

interface LoginResponseDto {
  access_token: string
}

function normalizeRole(role: unknown): UserRole {
  if (role === "admin" || role === "cashier" || role === "manager") return role
  return "cashier"
}

function resolveUsername(claims: JwtPayload | null, fallbackUsername: string | null): string {
  return claims?.username ?? claims?.sub ?? fallbackUsername ?? "unknown"
}

function buildSession(token: string, fallbackUsername: string | null): Session {
  const claims = decodeJwt(token)
  const username = resolveUsername(claims, fallbackUsername)

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

function mapError(error: unknown): AuthError {
  if (error instanceof BackendRequestError) {
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return { code: "INVALID_CREDENTIALS", message: error.message }
    }
    return { code: "SERVER_ERROR", message: error.message }
  }

  if (error instanceof Error) {
    if (error.message.includes("NEXT_PUBLIC_API_BASE_URL")) {
      return { code: "SERVER_ERROR", message: error.message }
    }
    return { code: "NETWORK_ERROR", message: error.message }
  }

  return { code: "NETWORK_ERROR", message: "An unexpected error occurred" }
}

export function createApiSessionAdapter(): SessionPort {
  return {
    async login(credentials: Credentials): Promise<Result<Session, AuthError>> {
      try {
        const dto = await apiRequest<LoginResponseDto>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: credentials.username.trim(),
            password: credentials.password.trim(),
          } satisfies LoginRequestDto),
        })

        setAccessToken(dto.access_token)
        storeUsername(credentials.username.trim())
        return ok(buildSession(dto.access_token, credentials.username.trim()))
      } catch (error) {
        return err(mapError(error))
      }
    },

    async logout(): Promise<void> {
      clearAccessToken()
      clearStoredUsername()
    },

    currentUser(): Session["user"] | null {
      const token = getAccessToken()
      if (!token) return null
      return buildSession(token, getStoredUsername()).user
    },
  }
}
