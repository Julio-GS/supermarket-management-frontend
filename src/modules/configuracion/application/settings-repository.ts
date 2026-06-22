import type { NotificationPrefs } from "../domain/notification-prefs"
import type { StoreProfile } from "../domain/store-profile"
import type { TeamMember } from "../domain/team-member"

export interface SettingsRepository {
  getProfile(): Promise<StoreProfile>
  updateProfile(profile: StoreProfile): Promise<StoreProfile>
  listMembers(): Promise<TeamMember[]>
  getNotificationPrefs(): Promise<NotificationPrefs>
  updateNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>
}
