import { describe, expect, it } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { NotificationPrefs } from "../../domain/notification-prefs"
import type { StoreProfile } from "../../domain/store-profile"
import type { TeamMember } from "../../domain/team-member"
import type { SettingsRepository } from "../settings-repository"
import { useSettings } from "../use-settings"

const fakeProfile: StoreProfile = {
  name: "Test Store",
  taxId: "T-123",
  phone: "+1",
  address: "Test Address",
}

const fakeMembers: TeamMember[] = [
  { name: "Alice", email: "alice@example.com", role: "Administradora", initials: "AL" },
]

const fakePrefs: NotificationPrefs = {
  lowStockAlerts: false,
  dailyReport: true,
  promotionalEmails: true,
}

function createFakeSettingsRepository(): SettingsRepository {
  let profile = { ...fakeProfile }
  let prefs = { ...fakePrefs }
  return {
    async getProfile() {
      return { ...profile }
    },
    async updateProfile(next) {
      profile = { ...next }
      return { ...profile }
    },
    async listMembers() {
      return [...fakeMembers]
    },
    async getNotificationPrefs() {
      return { ...prefs }
    },
    async updateNotificationPrefs(next) {
      prefs = { ...next }
      return { ...prefs }
    },
  }
}

describe("useSettings", () => {
  it("loads profile, members and notification prefs from the repository", async () => {
    const { result } = renderHook(() => useSettings(createFakeSettingsRepository()))

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => expect(result.current.profile).not.toBeNull())
    expect(result.current.profile?.name).toBe("Test Store")
    expect(result.current.members).toHaveLength(1)
    expect(result.current.notificationPrefs?.lowStockAlerts).toBe(false)
  })

  it("persists profile updates through the repository", async () => {
    const { result } = renderHook(() => useSettings(createFakeSettingsRepository()))

    await act(async () => {
      await result.current.load()
      await result.current.updateProfile({ ...fakeProfile, name: "Updated Store" })
    })

    await waitFor(() => expect(result.current.profile?.name).toBe("Updated Store"))
  })
})
