import type { Result } from "@/shared/domain/result"
import { ok, err } from "@/shared/domain/result"
import type { Session } from "./session"
import type { AuthError } from "./auth-error"

export interface Credentials {
  username: string
  password: string
}

export function validateCredentials(credentials: Credentials): Result<Session, AuthError> {
  const username = credentials.username.trim()
  const password = credentials.password.trim()

  if (username.length === 0) {
    return err({ code: "EMPTY_USERNAME", message: "Username is required" })
  }

  if (password.length === 0) {
    return err({ code: "EMPTY_PASSWORD", message: "Password is required" })
  }

  if (password.length < 4) {
    return err({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" })
  }

  return ok({
    user: {
      id: "u-1",
      username,
      email: "",
      name: "Demo User",
      role: "admin",
    },
  })
}
