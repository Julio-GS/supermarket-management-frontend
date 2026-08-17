import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  createBrowserUnauthorizedSessionPolicy,
  defaultUnauthorizedSessionPolicy,
} from "../unauthorized-session-policy"
import { setAccessToken } from "../auth-token-store"

describe("unauthorized-session policy", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("clears the token and navigates via the injected navigation port", () => {
    setAccessToken("token-1")
    const assignLogin = vi.fn()
    const policy = createBrowserUnauthorizedSessionPolicy({ navigation: { assignLogin } })

    policy.handleUnauthorized()

    expect(localStorage.getItem("sg-access-token")).toBeNull()
    expect(assignLogin).toHaveBeenCalledTimes(1)
  })

  it("clears the token and navigates on every invocation", () => {
    setAccessToken("token-1")
    const assignLogin = vi.fn()
    const policy = createBrowserUnauthorizedSessionPolicy({ navigation: { assignLogin } })

    policy.handleUnauthorized()
    policy.handleUnauthorized()

    expect(assignLogin).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem("sg-access-token")).toBeNull()
  })

  it("default policy clears the token and redirects to /login", () => {
    setAccessToken("token-1")
    const originalHref = window.location.href
    Object.defineProperty(window, "location", { writable: true, value: { href: "/app" } })

    defaultUnauthorizedSessionPolicy.handleUnauthorized()

    expect(localStorage.getItem("sg-access-token")).toBeNull()
    expect(window.location.href).toBe("/login")

    Object.defineProperty(window, "location", { writable: true, value: { href: originalHref } })
  })
})
