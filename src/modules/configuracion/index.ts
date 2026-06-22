// Domain
export type { StoreProfile } from "./domain/store-profile"
export { defaultStoreProfile } from "./domain/store-profile"
export type { TeamMember, TeamRole } from "./domain/team-member"
export type { NotificationPrefs } from "./domain/notification-prefs"
export { defaultNotificationPrefs, updateNotificationPrefs } from "./domain/notification-prefs"

// Application
export type { SettingsRepository } from "./application/settings-repository"
export { useSettings } from "./application/use-settings"
export type { UseSettingsResult } from "./application/use-settings"

// Infrastructure
export { createMockSettingsRepository } from "./infrastructure/mock-settings-repository"
export { settingsRepository } from "./infrastructure/settings-repository-instance"

// Composition
export { SettingsTabsShell } from "./composition/settings-tabs-shell"

// Presentation
export { SettingsTabs } from "./presentation/settings-tabs"
export type { SettingsTabsProps } from "./presentation/settings-tabs"
