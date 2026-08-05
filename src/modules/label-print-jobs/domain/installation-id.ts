const STORAGE_KEY = "label-printer-installation-id"

/** Retrieves or creates a stable installation identifier persisted in localStorage. */
export function getInstallationId(): string {
  if (typeof window === "undefined") {
    return "ssr-placeholder"
  }

  let id = window.localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = `label-printer-${crypto.randomUUID()}`
    window.localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
