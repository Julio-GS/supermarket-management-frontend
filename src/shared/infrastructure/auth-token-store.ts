const ACCESS_TOKEN_KEY = "sg-access-token"
const STORED_USERNAME_KEY = "sg-stored-username"

export interface JwtPayload {
  sub?: string
  username?: string
  name?: string
  role?: string
  email?: string
  exp?: number
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function storeUsername(username: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORED_USERNAME_KEY, username)
}

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(STORED_USERNAME_KEY)
}

export function clearStoredUsername(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORED_USERNAME_KEY)
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(base64)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}
