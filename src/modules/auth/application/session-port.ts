import type { Result } from "@/shared/domain/result"
import type { Credentials } from "../domain/credentials"
import type { Session } from "../domain/session"
import type { AuthError } from "../domain/auth-error"

export interface SessionPort {
  login(credentials: Credentials): Promise<Result<Session, AuthError>>
  logout(): Promise<void>
  currentUser(): Session["user"] | null
}
