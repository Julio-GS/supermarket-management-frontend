import { describe, expect, it } from "vitest"
import { validateCredentials } from "../credentials"

describe("validateCredentials", () => {
  it("returns a session for valid credentials", () => {
    const result = validateCredentials({ username: "admin", password: "1234" })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.value.user.username).toBe("admin")
    expect(result.value.user.role).toBe("admin")
  })

  it("returns EMPTY_USERNAME when username is blank", () => {
    const result = validateCredentials({ username: "   ", password: "1234" })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("EMPTY_USERNAME")
  })

  it("returns EMPTY_PASSWORD when password is blank", () => {
    const result = validateCredentials({ username: "admin", password: "   " })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("EMPTY_PASSWORD")
  })

  it("returns INVALID_CREDENTIALS when password is too short", () => {
    const result = validateCredentials({ username: "admin", password: "123" })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("INVALID_CREDENTIALS")
  })
})
