import { resolveDesktopApiBaseUrlByNullish } from "@/shared"

export function getAppApiBaseUrl(): string {
  if (typeof window === "undefined") return ""
  return resolveDesktopApiBaseUrlByNullish() ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
}
