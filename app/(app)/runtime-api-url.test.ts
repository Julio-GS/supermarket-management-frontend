import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { getAppApiBaseUrl } from "./runtime-api-url"

type DesktopWindow = typeof window & {
  marketDesktop?: Window["marketDesktop"]
  __MARKET_DESKTOP_CONFIG__?: Window["__MARKET_DESKTOP_CONFIG__"]
}

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

describe("getAppApiBaseUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl
    delete (window as DesktopWindow).marketDesktop
    delete (window as DesktopWindow).__MARKET_DESKTOP_CONFIG__
  })

  it("falls back to the web environment variable", () => {
    expect(getAppApiBaseUrl()).toBe("https://api.example.com/api/v1")
  })

  it("returns an empty string when neither desktop nor env provides a value", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = ""
    expect(getAppApiBaseUrl()).toBe("")
  })

  it("retains an empty injected config without falling through to the bridge", () => {
    ;(window as DesktopWindow).__MARKET_DESKTOP_CONFIG__ = { apiBaseUrl: "" }
    ;(window as DesktopWindow).marketDesktop = {
      getConfig: () => ({ apiBaseUrl: "http://bridge/api/v1" }),
    } as Window["marketDesktop"]

    expect(getAppApiBaseUrl()).toBe("")
  })
})
