import { describe, expect, it, vi } from "vitest"
import {
  resolveDesktopApiBaseUrlByNullish,
  resolveDesktopApiBaseUrlByTruthiness,
  type DesktopApiBaseUrlSourceReader,
} from "../runtime-api-config"

function reader(injected: string | undefined, bridge: string | undefined): DesktopApiBaseUrlSourceReader {
  return { readInjected: () => injected, readBridge: vi.fn(() => bridge) }
}

describe("resolveDesktopApiBaseUrlByTruthiness", () => {
  it("keeps a truthy injected value and skips the bridge", () => {
    const r = reader("http://injected/api/v1", "http://bridge/api/v1")
    expect(resolveDesktopApiBaseUrlByTruthiness(r)).toBe("http://injected/api/v1")
    expect(r.readBridge).not.toHaveBeenCalled()
  })

  it("falls through to the bridge when injected is empty", () => {
    const r = reader("", "http://bridge/api/v1")
    expect(resolveDesktopApiBaseUrlByTruthiness(r)).toBe("http://bridge/api/v1")
    expect(r.readBridge).toHaveBeenCalledTimes(1)
  })

  it("returns undefined when both sources are missing", () => {
    expect(resolveDesktopApiBaseUrlByTruthiness(reader(undefined, undefined))).toBeUndefined()
  })
})

describe("resolveDesktopApiBaseUrlByNullish", () => {
  it("keeps an empty injected value and skips the bridge", () => {
    const r = reader("", "http://bridge/api/v1")
    expect(resolveDesktopApiBaseUrlByNullish(r)).toBe("")
    expect(r.readBridge).not.toHaveBeenCalled()
  })

  it("falls through to the bridge when injected is undefined", () => {
    const r = reader(undefined, "http://bridge/api/v1")
    expect(resolveDesktopApiBaseUrlByNullish(r)).toBe("http://bridge/api/v1")
    expect(r.readBridge).toHaveBeenCalledTimes(1)
  })

  it("propagates a synchronous bridge exception", () => {
    const r: DesktopApiBaseUrlSourceReader = {
      readInjected: () => undefined,
      readBridge: () => {
        throw new Error("bridge unavailable")
      },
    }
    expect(() => resolveDesktopApiBaseUrlByNullish(r)).toThrow("bridge unavailable")
  })
})
