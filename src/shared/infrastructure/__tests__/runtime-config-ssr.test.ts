// @vitest-environment node

import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { getApiBaseUrl } from "../api-client"
import {
  resolveDesktopApiBaseUrlByNullish,
  resolveDesktopApiBaseUrlByTruthiness,
} from "../runtime-api-config"
import { defaultUnauthorizedSessionPolicy } from "../unauthorized-session-policy"
import { getAppApiBaseUrl } from "@/app/(app)/runtime-api-url"

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

describe("server-side runtime config and unauthorized policy", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl
  })

  it("returns undefined from the desktop accessors when window is undefined", () => {
    expect(resolveDesktopApiBaseUrlByTruthiness()).toBeUndefined()
    expect(resolveDesktopApiBaseUrlByNullish()).toBeUndefined()
  })

  it("falls back to the env variable from api-client on the server", () => {
    expect(getApiBaseUrl()).toBe("https://api.example.com/api/v1")
  })

  it("throws from api-client on the server when no env variable is set", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = ""
    expect(() => getApiBaseUrl()).toThrow("API base URL is not configured")
  })

  it("returns an empty string from the app layout helper on the server", () => {
    expect(getAppApiBaseUrl()).toBe("")
  })

  it("does not navigate or clear tokens on the server", () => {
    expect(() => defaultUnauthorizedSessionPolicy.handleUnauthorized()).not.toThrow()
  })
})
