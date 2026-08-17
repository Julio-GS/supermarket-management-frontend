import { clearAccessToken } from "./auth-token-store"

export interface UnauthorizedSessionPolicy {
  handleUnauthorized(): void
}

export interface BrowserNavigationPort {
  assignLogin(): void
}

const defaultBrowserNavigation: BrowserNavigationPort = {
  assignLogin() {
    window.location.href = "/login"
  },
}

export function createBrowserUnauthorizedSessionPolicy(options?: {
  navigation?: BrowserNavigationPort
}): UnauthorizedSessionPolicy {
  const navigation = options?.navigation ?? defaultBrowserNavigation
  return {
    handleUnauthorized() {
      if (typeof window === "undefined") return
      clearAccessToken()
      navigation.assignLogin()
    },
  }
}

export const defaultUnauthorizedSessionPolicy: UnauthorizedSessionPolicy =
  createBrowserUnauthorizedSessionPolicy()
