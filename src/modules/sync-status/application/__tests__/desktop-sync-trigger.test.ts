import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

import { triggerDesktopSync } from "../desktop-sync-trigger"

describe("triggerDesktopSync", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (window as typeof window & { marketDesktop?: Window["marketDesktop"] }).marketDesktop
  })

  it("starts desktop sync once for a burst of mutation triggers", async () => {
    const start = vi.fn().mockResolvedValue({
      synced: 1,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    })

    window.localStorage.setItem("sg-access-token", "token-1")
    ;(window as typeof window & { marketDesktop?: Window["marketDesktop"] }).marketDesktop = {
      getConfig: () => ({ apiBaseUrl: "http://desktop.test/api/v1" }),
      sync: {
        start,
      },
    }

    const first = triggerDesktopSync({ reason: "first" })
    const second = triggerDesktopSync({ reason: "second" })

    await vi.runAllTimersAsync()
    await Promise.all([first, second])

    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith({
      token: "token-1",
      apiBaseUrl: "http://desktop.test/api/v1",
    })
  })

  it("swallows sync errors so mutation flows stay non-blocking", async () => {
    const start = vi.fn().mockRejectedValue(new Error("sync failed"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    window.localStorage.setItem("sg-access-token", "token-1")
    ;(window as typeof window & { marketDesktop?: Window["marketDesktop"] }).marketDesktop = {
      getConfig: () => ({ apiBaseUrl: "http://desktop.test/api/v1" }),
      sync: {
        start,
      },
    }

    const syncAttempt = triggerDesktopSync({ reason: "failure" })
    await vi.runAllTimersAsync()
    await expect(syncAttempt).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalled()
  })
})
