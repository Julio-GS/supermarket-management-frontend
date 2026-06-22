"use client"

import { settingsRepository } from "../infrastructure/settings-repository-instance"
import { SettingsTabs } from "../presentation/settings-tabs"

export function SettingsTabsShell() {
  return <SettingsTabs repository={settingsRepository} />
}
