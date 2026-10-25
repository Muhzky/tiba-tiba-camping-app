import { useQuery } from '@tanstack/react-query'
import { siteSettingsOptions } from '#/server/fn/settings'
import type { SiteSettings } from '#/server/fn/settings'
import { siteSettingsDefaults } from '#/lib/site-settings'

/**
 * Pengaturan situs untuk komponen publik. Loader layout sudah mem-prefetch,
 * jadi nilai ini hampir selalu tersedia; fallback menjaga render pertama aman.
 */
export function useSiteSettings(): SiteSettings {
  const { data } = useQuery(siteSettingsOptions)
  return data ?? { ...siteSettingsDefaults, updatedAt: null }
}
