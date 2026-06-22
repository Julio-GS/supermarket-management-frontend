export type AuthErrorCode = "INVALID_CREDENTIALS" | "EMPTY_EMAIL" | "EMPTY_PASSWORD"

export interface AuthError {
  code: AuthErrorCode
  message: string
}
