import {
  defaultNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "../domain/notification-prefs"
import { defaultStoreProfile, type StoreProfile } from "../domain/store-profile"
import type { TeamMember, TeamRole } from "../domain/team-member"
import type { SettingsRepository } from "../application/settings-repository"

const defaultMembers: TeamMember[] = [
  { name: "Ana López", email: "ana@supergestion.com", role: "Administradora", initials: "AL" },
  { name: "Carlos Ruiz", email: "carlos@supergestion.com", role: "Cajero", initials: "CR" },
  { name: "Marta Gil", email: "marta@supergestion.com", role: "Cajera", initials: "MG" },
  { name: "Pedro Sanz", email: "pedro@supergestion.com", role: "Inventario", initials: "PS" },
]

export function createMockSettingsRepository(): SettingsRepository {
  let profile: StoreProfile = { ...defaultStoreProfile }
  let members: TeamMember[] = [...defaultMembers]
  let notificationPrefs: NotificationPrefs = { ...defaultNotificationPrefs }

  return {
    async getProfile(): Promise<StoreProfile> {
      return { ...profile }
    },

    async updateProfile(nextProfile: StoreProfile): Promise<StoreProfile> {
      profile = { ...nextProfile }
      return { ...profile }
    },

    async listMembers(): Promise<TeamMember[]> {
      return [...members]
    },

    async getNotificationPrefs(): Promise<NotificationPrefs> {
      return { ...notificationPrefs }
    },

    async updateNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs> {
      notificationPrefs = updateNotificationPrefs(notificationPrefs, prefs)
      return { ...notificationPrefs }
    },
  }
}

export type { TeamRole }
