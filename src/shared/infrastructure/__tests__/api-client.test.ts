import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { apiRequest, BackendRequestError, getApiBaseUrl } from "../api-client"
import { getAccessToken, clearAccessToken } from "../auth-token-store"

vi.mock("../auth-token-store", () => ({
  getAccessToken: vi.fn(() => null),
  clearAccessToken: vi.fn(),
}))

const mockGetAccessToken = vi.mocked(getAccessToken)
const mockClearAccessToken = vi.mocked(clearAccessToken)

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

describe("apiRequest", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    mockGetAccessToken.mockReturnValue(null)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl
    vi.unstubAllGlobals()
  })

  function getFetchMock() {
    return vi.mocked(fetch)
  }

  it("throws when NEXT_PUBLIC_API_BASE_URL is missing", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = ""
    await expect(apiRequest("/test")).rejects.toThrow("NEXT_PUBLIC_API_BASE_URL")
  })

  it("returns getApiBaseUrl", () => {
    expect(getApiBaseUrl()).toBe("https://api.example.com/api/v1")
  })

  it("includes Authorization header when token exists", async () => {
    mockGetAccessToken.mockReturnValue("token123")
    await apiRequest("/test")

    const fetchMock = getFetchMock()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer token123")
  })

  it("does not include Authorization header when token is missing", async () => {
    await apiRequest("/test")

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Headers
    expect(headers.has("Authorization")).toBe(false)
  })

  it("sets Content-Type for JSON bodies", async () => {
    await apiRequest("/test", { method: "POST", body: JSON.stringify({ foo: "bar" }) })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Headers
    expect(headers.get("Content-Type")).toBe("application/json")
  })

  it("returns parsed JSON on success", async () => {
    const fetchMock = getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), { status: 200 })
    )
    const result = await apiRequest<{ id: string }>("/test")
    expect(result).toEqual({ id: "1" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/test",
      expect.any(Object)
    )
  })

  it("throws BackendRequestError with backend message on failure", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid input" }), { status: 422 })
    )
    await expect(apiRequest("/test")).rejects.toSatisfy(
      (error) =>
        error instanceof BackendRequestError &&
        error.status === 422 &&
        error.message === "Invalid input"
    )
  })

  it("throws BackendRequestError and redirects on 401", async () => {
    const originalHref = window.location.href
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "/app" },
    })
    mockGetAccessToken.mockReturnValue("token123")

    getFetchMock().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 }))
    await expect(apiRequest("/test")).rejects.toSatisfy(
      (error) => error instanceof BackendRequestError && error.status === 401
    )
    expect(window.location.href).toBe("/login")
    expect(mockClearAccessToken).toHaveBeenCalled()

    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: originalHref },
    })
  })
})
