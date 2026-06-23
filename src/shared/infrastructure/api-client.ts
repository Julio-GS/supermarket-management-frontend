import { clearAccessToken, getAccessToken } from "./auth-token-store"

export class BackendRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "BackendRequestError"
  }
}

export function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured")
  }
  return baseUrl
}

function handleUnauthorized(): void {
  if (typeof window === "undefined") return
  clearAccessToken()
  window.location.href = "/login"
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const token = getAccessToken()
  const headers = new Headers(options.headers ?? {})

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json")
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })

  if (response.status === 401) {
    handleUnauthorized()
    throw new BackendRequestError(401, "Session expired. Please log in again.")
  }

  if (!response.ok) {
    const body = await response.text()
    let message = `Request failed with status ${response.status}`
    try {
      const parsed = JSON.parse(body) as unknown
      if (hasStringMessage(parsed)) {
        message = parsed.message
      }
    } catch {
      // body is not JSON; keep the status-based message
    }
    throw new BackendRequestError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function hasStringMessage(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  )
}
