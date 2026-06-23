import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiSessionAdapter } from "../api-session-adapter"

describe("createApiSessionAdapter", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    localStorage.clear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function getFetchMock() {
    return vi.mocked(fetch)
  }

  it("logs in with username and password and stores the access token", async () => {
    const tokenPayload = { sub: "u-1", username: "ana.lopez", role: "admin" }
    const accessToken = `header.${btoa(JSON.stringify(tokenPayload))}.signature`
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ access_token: accessToken }), { status: 201 })
    )

    const adapter = createApiSessionAdapter()
    const result = await adapter.login({ username: "ana.lopez", password: "secret" })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.value.user.username).toBe("ana.lopez")
    expect(result.value.user.role).toBe("admin")
    expect(localStorage.getItem("sg-access-token")).toBe(accessToken)
    expect(localStorage.getItem("sg-stored-username")).toBe("ana.lopez")

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
      username: "ana.lopez",
      password: "secret",
    })
  })

  it("returns INVALID_CREDENTIALS on backend error", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
    )

    const adapter = createApiSessionAdapter()
    const result = await adapter.login({ username: "bad", password: "wrong" })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("INVALID_CREDENTIALS")
  })

  it("derives current user from JWT claims", async () => {
    const tokenPayload = { sub: "u-1", username: "ana.lopez", name: "Ana López", role: "manager" }
    const accessToken = `header.${btoa(JSON.stringify(tokenPayload))}.signature`
    localStorage.setItem("sg-access-token", accessToken)

    const adapter = createApiSessionAdapter()
    const user = adapter.currentUser()

    expect(user).not.toBeNull()
    expect(user?.id).toBe("u-1")
    expect(user?.username).toBe("ana.lopez")
    expect(user?.name).toBe("Ana López")
    expect(user?.role).toBe("manager")
  })

  it("falls back to stored username when JWT has no user claims", async () => {
    const tokenPayload = { exp: 1234567890 }
    const accessToken = `header.${btoa(JSON.stringify(tokenPayload))}.signature`
    localStorage.setItem("sg-access-token", accessToken)
    localStorage.setItem("sg-stored-username", "ana.lopez")

    const adapter = createApiSessionAdapter()
    const user = adapter.currentUser()

    expect(user?.username).toBe("ana.lopez")
    expect(user?.name).toBe("ana.lopez")
  })

  it("clears session on logout", async () => {
    localStorage.setItem("sg-access-token", "token123")
    localStorage.setItem("sg-stored-username", "ana.lopez")

    const adapter = createApiSessionAdapter()
    await adapter.logout()

    expect(localStorage.getItem("sg-access-token")).toBeNull()
    expect(localStorage.getItem("sg-stored-username")).toBeNull()
  })
})
