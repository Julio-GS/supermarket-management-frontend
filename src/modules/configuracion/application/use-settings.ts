"use client"

import { useCallback, useState } from "react"
import type { NotificationPrefs } from "../domain/notification-prefs"
import type { StoreProfile } from "../domain/store-profile"
import type { TeamMember } from "../domain/team-member"
import type { SettingsRepository } from "./settings-repository"

export interface UseSettingsResult {
  profile: StoreProfile | null
  members: TeamMember[]
  notificationPrefs: NotificationPrefs | null
  isLoading: boolean
  error: string | null
  load: () => Promise<void>
  updateProfile: (profile: StoreProfile) => Promise<void>
  updateNotificationPrefs: (prefs: NotificationPrefs) => Promise<void>
}

export function useSettings(repository: SettingsRepository): UseSettingsResult {
  const [profile, setProfile] = useState<StoreProfile | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [loadedProfile, loadedMembers, loadedPrefs] = await Promise.all([
        repository.getProfile(),
        repository.listMembers(),
        repository.getNotificationPrefs(),
      ])
      setProfile(loadedProfile)
      setMembers(loadedMembers)
      setNotificationPrefs(loadedPrefs)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [repository])

  const updateProfile = useCallback(
    async (nextProfile: StoreProfile) => {
      const saved = await repository.updateProfile(nextProfile)
      setProfile(saved)
    },
    [repository]
  )

  const updateNotificationPrefs = useCallback(
    async (nextPrefs: NotificationPrefs) => {
      const saved = await repository.updateNotificationPrefs(nextPrefs)
      setNotificationPrefs(saved)
    },
    [repository]
  )

  return {
    profile,
    members,
    notificationPrefs,
    isLoading,
    error,
    load,
    updateProfile,
    updateNotificationPrefs,
  }
}
