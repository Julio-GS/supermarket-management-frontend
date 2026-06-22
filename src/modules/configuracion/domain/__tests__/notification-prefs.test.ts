import { describe, expect, it } from "vitest"
import {
  defaultNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "../notification-prefs"

describe("notification prefs domain rules", () => {
  it("merges partial changes without mutating the original prefs", () => {
    const current: NotificationPrefs = { ...defaultNotificationPrefs }
    const updated = updateNotificationPrefs(current, { dailyReport: false })

    expect(updated).toEqual({
      lowStockAlerts: true,
      dailyReport: false,
      promotionalEmails: false,
    })
    expect(current.dailyReport).toBe(true)
  })
})
