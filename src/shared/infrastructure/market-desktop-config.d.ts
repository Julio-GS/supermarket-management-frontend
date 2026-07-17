export interface MarketDesktopRuntimeConfig {
  apiBaseUrl: string
  frontendDevUrl?: string
  appVersion?: string
  updateEnabled?: boolean
}

declare global {
  interface Window {
    __MARKET_DESKTOP_CONFIG__?: MarketDesktopRuntimeConfig
    marketDesktop?: {
      getConfig(): MarketDesktopRuntimeConfig
      platform?: NodeJS.Platform
    }
  }
}

export {}
