import { describe, expect, it } from "vitest"
import { validateCredentials } from "../credentials"

describe("validateCredentials", () => {
  it("returns a session for valid credentials", () => {
    const result = validateCredentials({ email: "test@example.com", password: "1234" })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.value.user.email).toBe("test@example.com")
    expect(result.value.user.role).toBe("admin")
  })

  it("returns EMPTY_EMAIL when email is blank", () => {
    const result = validateCredentials({ email: "   ", password: "1234" })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("EMPTY_EMAIL")
  })

  it("returns EMPTY_PASSWORD when password is blank", () => {
    const result = validateCredentials({ email: "test@example.com", password: "   " })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("EMPTY_PASSWORD")
  })

  it("returns INVALID_CREDENTIALS when email has no @", () => {
    const result = validateCredentials({ email: "invalid", password: "1234" })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("INVALID_CREDENTIALS")
  })

  it("returns INVALID_CREDENTIALS when password is too short", () => {
    const result = validateCredentials({ email: "test@example.com", password: "123" })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("INVALID_CREDENTIALS")
  })
})
