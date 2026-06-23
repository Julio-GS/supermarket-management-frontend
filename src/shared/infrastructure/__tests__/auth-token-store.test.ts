import { describe, expect, it, beforeEach } from "vitest"
import {
  clearAccessToken,
  clearStoredUsername,
  decodeJwt,
  getAccessToken,
  getStoredUsername,
  setAccessToken,
  storeUsername,
} from "../auth-token-store"

describe("auth token store", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("stores and retrieves the access token", () => {
    setAccessToken("token123")
    expect(getAccessToken()).toBe("token123")
  })

  it("clears the access token", () => {
    setAccessToken("token123")
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it("stores and retrieves the fallback username", () => {
    storeUsername("ana.lopez")
    expect(getStoredUsername()).toBe("ana.lopez")
  })

  it("clears the fallback username", () => {
    storeUsername("ana.lopez")
    clearStoredUsername()
    expect(getStoredUsername()).toBeNull()
  })

  describe("decodeJwt", () => {
    it("decodes a valid JWT payload", () => {
      const payload = { sub: "u-1", username: "ana.lopez", role: "admin" }
      const token = `header.${btoa(JSON.stringify(payload))}.signature`
      const decoded = decodeJwt(token)
      expect(decoded).toEqual(payload)
    })

    it("returns null for an invalid token", () => {
      expect(decodeJwt("not-a-jwt")).toBeNull()
    })
  })
})
