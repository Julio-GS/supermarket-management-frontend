export interface NotificationPrefs {
  lowStockAlerts: boolean
  dailyReport: boolean
  promotionalEmails: boolean
}

export const defaultNotificationPrefs: NotificationPrefs = {
  lowStockAlerts: true,
  dailyReport: true,
  promotionalEmails: false,
}

export function updateNotificationPrefs(
  current: NotificationPrefs,
  changes: Partial<NotificationPrefs>
): NotificationPrefs {
  return { ...current, ...changes }
}
