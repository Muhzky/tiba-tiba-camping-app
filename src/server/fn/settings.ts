import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/server/db'
import { siteSettings, users } from '#/server/db/schema'
import { queryKeys } from '#/lib/query-keys'
import { siteSettingsDefaults } from '#/lib/site-settings'
import type { SiteSettingsValues } from '#/lib/site-settings'
import { audit, requireAdmin } from '#/server/fn/admin'
import { profileImageField } from '#/server/fn/account'

export type SiteSettings = SiteSettingsValues & { updatedAt: Date | null }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[\d+()\-\s]{6,30}$/
const urlPattern = /^https?:\/\/\S+$/i

const contactEmailField = z
  .string()
  .trim()
  .min(3, 'Email wajib diisi')
  .max(160, 'Email terlalu panjang')
  .refine((value) => emailPattern.test(value), 'Format email tidak valid')

const contactPhoneField = z
  .string()
  .trim()
  .min(6, 'Nomor HP wajib diisi')
  .max(30, 'Nomor HP terlalu panjang')
  .refine((value) => phonePattern.test(value), 'Nomor HP tidak valid')

/** URL media sosial boleh kosong; hanya menerima http(s). */
const socialUrlField = z
  .string()
  .trim()
  .max(300, 'URL terlalu panjang')
  .refine(
    (value) => value === '' || urlPattern.test(value),
    'URL harus diawali http:// atau https://',
  )

export const siteSettingsSchema = z.object({
  contactEmail: contactEmailField,
  contactPhone: contactPhoneField,
  address: z
    .string()
    .trim()
    .min(5, 'Alamat wajib diisi')
    .max(300, 'Alamat terlalu panjang'),
  openingDays: z
    .string()
    .trim()
    .min(2, 'Hari buka wajib diisi')
    .max(80, 'Hari buka terlalu panjang'),
  openingHours: z
    .string()
    .trim()
    .min(2, 'Jam buka wajib diisi')
    .max(80, 'Jam buka terlalu panjang'),
  timezone: z
    .string()
    .trim()
    .min(2, 'Zona waktu wajib diisi')
    .max(80, 'Zona waktu terlalu panjang'),
  footerDescription: z
    .string()
    .trim()
    .max(240, 'Deskripsi footer maksimal 240 karakter'),
  instagramUrl: socialUrlField,
  youtubeUrl: socialUrlField,
  facebookUrl: socialUrlField,
  tiktokUrl: socialUrlField,
})

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>

function mapSettings(row: typeof siteSettings.$inferSelect): SiteSettings {
  return {
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    address: row.address,
    openingDays: row.openingDays,
    openingHours: row.openingHours,
    timezone: row.timezone,
    footerDescription: row.footerDescription,
    instagramUrl: row.instagramUrl ?? '',
    youtubeUrl: row.youtubeUrl ?? '',
    facebookUrl: row.facebookUrl ?? '',
    tiktokUrl: row.tiktokUrl ?? '',
    updatedAt: row.updatedAt,
  }
}

/** Dibaca halaman publik; baris belum ada berarti pakai nilai bawaan. */
export const getSiteSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SiteSettings> => {
    const [row] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1)
    if (!row) return { ...siteSettingsDefaults, updatedAt: null }
    return mapSettings(row)
  },
)

export const siteSettingsOptions = queryOptions({
  queryKey: queryKeys.siteSettings(),
  queryFn: () => getSiteSettings(),
  staleTime: 60_000,
})

export const updateSiteSettings = createServerFn({ method: 'POST' })
  .validator(siteSettingsSchema)
  .handler(async ({ data }): Promise<SiteSettings> => {
    const actor = await requireAdmin()
    const now = new Date()
    const [row] = await db
      .insert(siteSettings)
      .values({ id: 1, ...data })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: { ...data, updatedAt: now },
      })
      .returning()
    if (!row) throw new Error('GAGAL_MENYIMPAN_PENGATURAN')
    await audit(actor.id, 'settings.update', 'site_settings', '1', { ...data })
    return mapSettings(row)
  })

// ── Profil admin ─────────────────────────────────────────────────────────────

export const adminProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama minimal 2 karakter')
    .max(80, 'Nama maksimal 80 karakter'),
  email: contactEmailField,
  phone: z
    .string()
    .trim()
    .max(30, 'Nomor HP terlalu panjang')
    .refine(
      (value) => value === '' || phonePattern.test(value),
      'Nomor HP tidak valid',
    ),
  /** Foto profil admin — aturan yang sama dengan foto profil pelanggan. */
  image: profileImageField,
})

export type AdminProfileInput = z.infer<typeof adminProfileSchema>

export type AdminProfile = {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  role: 'customer' | 'admin'
  isActive: boolean
}

export const updateAdminProfile = createServerFn({ method: 'POST' })
  .validator(adminProfileSchema)
  .handler(async ({ data }): Promise<AdminProfile> => {
    const actor = await requireAdmin()
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, data.email), ne(users.id, actor.id)))
      .limit(1)
    if (clash) throw new Error('EMAIL_SUDAH_DIPAKAI')

    const [row] = await db
      .update(users)
      .set({
        name: data.name,
        email: data.email,
        phone: data.phone === '' ? null : data.phone,
        image: data.image,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        image: users.image,
        role: users.role,
        isActive: users.isActive,
      })
    if (!row) throw new Error('USER_TIDAK_DITEMUKAN')
    // Catat perubahan foto sebagai status saja — data URL-nya bisa ratusan KB
    // dan tidak pantas masuk audit log.
    const imageChanged = (data.image ?? null) !== actor.image
    await audit(actor.id, 'profile.update', 'user', actor.id, {
      name: data.name,
      email: data.email,
      ...(imageChanged ? { image: data.image ? 'updated' : 'cleared' } : {}),
    })
    return row
  })
