/**
 * Nilai bawaan + helper tampilan pengaturan situs.
 *
 * Disimpan terpisah dari server function supaya komponen publik bisa memakai
 * fallback yang sama saat data belum termuat (mis. render pertama/offline).
 */
export type SiteSettingsValues = {
  contactEmail: string
  contactPhone: string
  address: string
  openingDays: string
  openingHours: string
  timezone: string
  footerDescription: string
  instagramUrl: string
  youtubeUrl: string
  facebookUrl: string
  tiktokUrl: string
}

export const siteSettingsDefaults: SiteSettingsValues = {
  contactEmail: 'halo@tibatibacamping.test',
  contactPhone: '+62 812-0000-0000',
  address: 'Jl. Cempaka No. 12, Bandung',
  openingDays: 'Senin–Sabtu',
  openingHours: '09.00–18.00',
  timezone: 'WIB (Asia/Jakarta)',
  footerDescription:
    '“Outdoor gear — rencana boleh dadakan, gear harus matang.”',
  instagramUrl: '',
  youtubeUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
}

/** `Senin–Sabtu, 09.00–18.00` (tanpa zona waktu). */
export function openingHoursLine(values: {
  openingDays: string
  openingHours: string
}): string {
  const days = values.openingDays.trim()
  const hours = values.openingHours.trim()
  if (days && hours) return `${days}, ${hours}`
  return days || hours
}

/** `WIB` dari `WIB (Asia/Jakarta)`; nilai utuh bila tidak berpola. */
export function timezoneShort(value: string): string {
  const first = value.trim().split(/[\s(]/)[0]
  return first || value.trim()
}

/** `Senin–Sabtu, 09.00–18.00 WIB` — format ringkas untuk navbar/detail. */
export function openingHoursWithZone(values: {
  openingDays: string
  openingHours: string
  timezone: string
}): string {
  const line = openingHoursLine(values)
  const zone = timezoneShort(values.timezone)
  return [line, zone].filter(Boolean).join(' ')
}

/** Nomor telepon aman untuk tautan `tel:` (hanya digit dan `+`). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export type SocialLink = {
  key: 'instagram' | 'youtube' | 'facebook' | 'tiktok'
  label: string
  url: string
}

/** Hanya media sosial yang URL-nya sudah diisi. */
export function socialLinks(values: SiteSettingsValues): SocialLink[] {
  return (
    [
      { key: 'instagram', label: 'Instagram', url: values.instagramUrl },
      { key: 'youtube', label: 'YouTube', url: values.youtubeUrl },
      { key: 'facebook', label: 'Facebook', url: values.facebookUrl },
      { key: 'tiktok', label: 'TikTok', url: values.tiktokUrl },
    ] as SocialLink[]
  ).filter((link) => link.url.trim().length > 0)
}
