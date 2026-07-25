import { getAccessToken } from "@/shared/infrastructure/auth-token-store"

const SYNC_DEBOUNCE_MS = 300

let pendingTimer: number | null = null
let pendingPromise: Promise<void> | null = null
let pendingResolve: (() => void) | null = null
let inFlightPromise: Promise<void> | null = null

function clearPendingTimer() {
  if (pendingTimer != null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
}

async function runDesktopSync(reason: string): Promise<void> {
  const syncApi = typeof window === "undefined" ? undefined : window.marketDesktop?.sync
  const apiBaseUrl = typeof window === "undefined" ? undefined : window.marketDesktop?.getConfig().apiBaseUrl
  const token = getAccessToken() ?? undefined

  if (!syncApi?.start || !apiBaseUrl || !token) {
    return
  }

  if (inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = syncApi
    .start({ token, apiBaseUrl })
    .then(() => undefined)
    .catch((error) => {
      console.error("Desktop mutation-triggered sync failed", { reason, error })
    })
    .finally(() => {
      inFlightPromise = null
    })

  return inFlightPromise
}

export async function triggerDesktopSync({ reason }: { reason: string }): Promise<void> {
  if (typeof window === "undefined") {
    return
  }

  if (inFlightPromise) {
    return inFlightPromise
  }

  if (!pendingPromise) {
    pendingPromise = new Promise<void>((resolve) => {
      pendingResolve = resolve
    })
  }

  clearPendingTimer()
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null

    void runDesktopSync(reason).finally(() => {
      pendingResolve?.()
      pendingResolve = null
      pendingPromise = null
    })
  }, SYNC_DEBOUNCE_MS)

  return pendingPromise
}
