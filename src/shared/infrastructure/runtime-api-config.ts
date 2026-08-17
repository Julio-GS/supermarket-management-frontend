export interface DesktopApiBaseUrlSourceReader {
  readInjected(): string | undefined
  readBridge(): string | undefined
}

export function createBrowserDesktopApiBaseUrlSourceReader(): DesktopApiBaseUrlSourceReader {
  return {
    readInjected() {
      if (typeof window === "undefined") return undefined
      return window.__MARKET_DESKTOP_CONFIG__?.apiBaseUrl
    },
    readBridge() {
      if (typeof window === "undefined") return undefined
      return window.marketDesktop?.getConfig().apiBaseUrl
    },
  }
}

export function resolveDesktopApiBaseUrlByTruthiness(
  reader: DesktopApiBaseUrlSourceReader = createBrowserDesktopApiBaseUrlSourceReader()
): string | undefined {
  const injected = reader.readInjected()
  if (injected) {
    return injected
  }
  return reader.readBridge()
}

export function resolveDesktopApiBaseUrlByNullish(
  reader: DesktopApiBaseUrlSourceReader = createBrowserDesktopApiBaseUrlSourceReader()
): string | undefined {
  return reader.readInjected() ?? reader.readBridge()
}
