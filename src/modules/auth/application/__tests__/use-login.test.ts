import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useLogin } from "../use-login"
import type { SessionPort } from "../session-port"
import type { Session } from "../../domain/session"
import type { AuthError } from "../../domain/auth-error"
import type { Result } from "@/shared/domain/result"

function createFakePort(overrides?: Partial<SessionPort>): SessionPort {
  const session: Session = {
    user: { id: "u-1", email: "a@b.com", name: "Demo User", role: "admin" },
  }

  return {
    login: vi.fn().mockResolvedValue({ success: true, value: session } as Result<Session, AuthError>),
    logout: vi.fn().mockResolvedValue(undefined),
    currentUser: vi.fn().mockReturnValue(null),
    ...overrides,
  }
}

describe("useLogin", () => {
  it("starts in idle state", () => {
    const port = createFakePort()
    const { result } = renderHook(() => useLogin(port))

    expect(result.current.state.status).toBe("idle")
  })

  it("transitions to success when adapter resolves", async () => {
    const port = createFakePort()
    const { result } = renderHook(() => useLogin(port))

    await act(async () => {
      await result.current.login({ email: "a@b.com", password: "1234" })
    })

    expect(result.current.state.status).toBe("success")
    expect(port.login).toHaveBeenCalledWith({ email: "a@b.com", password: "1234" })
  })

  it("sets error state when adapter rejects credentials", async () => {
    const error: AuthError = { code: "INVALID_CREDENTIALS", message: "Invalid credentials" }
    const port = createFakePort({
      login: vi.fn().mockResolvedValue({ success: false, error } as Result<Session, AuthError>),
    })
    const { result } = renderHook(() => useLogin(port))

    await act(async () => {
      await result.current.login({ email: "bad", password: "123" })
    })

    expect(result.current.state.status).toBe("error")
    if (result.current.state.status !== "error") return

    expect(result.current.state.error.code).toBe("INVALID_CREDENTIALS")
  })
})
