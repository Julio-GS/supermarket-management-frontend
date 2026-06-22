import type { Result } from "@/shared/domain/result"
import type { AuthError } from "../domain/auth-error"
import type { Credentials } from "../domain/credentials"
import { validateCredentials } from "../domain/credentials"
import type { Session } from "../domain/session"
import type { SessionPort } from "../application/session-port"

const STORAGE_KEY = "sg-session"

function loadSession(): Session | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(session: Session | null): void {
  if (typeof window === "undefined") return
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function createMockSessionAdapter(): SessionPort {
  let session = loadSession()

  return {
    async login(credentials: Credentials): Promise<Result<Session, AuthError>> {
      await new Promise((resolve) => setTimeout(resolve, 700))
      const result = validateCredentials(credentials)
      if (!result.success) return result
      session = result.value
      saveSession(session)
      return { success: true, value: session }
    },
    async logout(): Promise<void> {
      session = null
      saveSession(null)
    },
    currentUser(): Session["user"] | null {
      return session?.user ?? null
    },
  }
}
