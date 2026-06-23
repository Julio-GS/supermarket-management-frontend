export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMPTY_USERNAME"
  | "EMPTY_PASSWORD"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"

export interface AuthError {
  code: AuthErrorCode
  message: string
}
