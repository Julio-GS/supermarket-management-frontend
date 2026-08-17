import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createDesktopSessionAdapter } from "../desktop-session-adapter"

type DesktopWindow = typeof window & {
  marketDesktop?: Window["marketDesktop"]
  __MARKET_DESKTOP_CONFIG__?: Window["__MARKET_DESKTOP_CONFIG__"]
}

describe("createDesktopSessionAdapter — api base URL resolution", () => {
  let loginMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    loginMock = vi.fn().mockResolvedValue({ success: true, username: "ana.lopez", token: "h.b.s" })
  })

  afterEach(() => {
    delete (window as DesktopWindow).marketDesktop
    delete (window as DesktopWindow).__MARKET_DESKTOP_CONFIG__
  })

  async function login() {
    return createDesktopSessionAdapter().login({ username: "ana.lopez", password: "secret" })
  }

  it("sends the injected desktop config as apiBaseUrl", async () => {
    ;(window as DesktopWindow).__MARKET_DESKTOP_CONFIG__ = { apiBaseUrl: "http://injected/api/v1" }
    ;(window as DesktopWindow).marketDesktop = {
      getConfig: () => ({ apiBaseUrl: "http://bridge/api/v1" }),
      offline: { login: loginMock },
    } as unknown as Window["marketDesktop"]

    await login()

    expect(loginMock).toHaveBeenCalledWith({
      username: "ana.lopez",
      password: "secret",
      apiBaseUrl: "http://injected/api/v1",
    })
  })

  it("falls back to the hardcoded localhost URL when both desktop sources are absent", async () => {
    ;(window as DesktopWindow).marketDesktop = {
      getConfig: () => ({ apiBaseUrl: undefined as unknown as string }),
      offline: { login: loginMock },
    } as unknown as Window["marketDesktop"]

    await login()

    expect(loginMock).toHaveBeenCalledWith({
      username: "ana.lopez",
      password: "secret",
      apiBaseUrl: "http://localhost:3001/api/v1",
    })
  })
})
