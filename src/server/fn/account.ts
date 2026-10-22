import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { queryOptions } from '@tanstack/react-query'
import { db } from '#/server/db'
import {
  addresses,
  categories,
  favorites,
  productImages,
  products,
  userPreferences,
  users,
} from '#/server/db/schema'
import { queryKeys } from '#/lib/query-keys'
import { getSessionUser } from '#/server/fn/auth'
import { fetchColors, toCard } from '#/server/fn/product'
import { recordProductEvent } from '#/server/recommender/profile'

async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

// ── Profil ───────────────────────────────────────────────────────────────────

const profileColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  image: users.image,
  role: users.role,
  createdAt: users.createdAt,
}

/** Avatar data URL fallback (used when object storage isn't configured). */
export const MAX_PROFILE_IMAGE_LENGTH = 400_000

const dataImagePattern =
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => value === '' || /^0\d{8,12}$/.test(value),
      'Nomor HP tidak valid',
    )
    .nullish()
    .transform((value) => value || null),
  image: z
    .string()
    .trim()
    .max(MAX_PROFILE_IMAGE_LENGTH)
    .refine(
      (value) =>
        value === '' ||
        value.startsWith('/') ||
        /^https?:\/\//i.test(value) ||
        dataImagePattern.test(value),
      'URL foto tidak valid',
    )
    .nullish()
    .transform((value) => value || null),
})

export type ProfileInput = z.infer<typeof profileSchema>

export const getMyProfile = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const [row] = await db
      .select(profileColumns)
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    if (!row) throw new Error('NOT_FOUND')
    return row
  },
)

export const profileOptions = queryOptions({
  queryKey: [...queryKeys.me(), 'profile'],
  queryFn: () => getMyProfile(),
  staleTime: 30_000,
})

export const updateProfile = createServerFn({ method: 'POST' })
  .validator(profileSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .update(users)
      .set({
        name: data.name,
        phone: data.phone,
        image: data.image,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning(profileColumns)
    if (!row) throw new Error('NOT_FOUND')
    return row
  })

// ── Favorit ──────────────────────────────────────────────────────────────────

export const isFavorite = createServerFn({ method: 'GET' })
  .validator((productId: string) => productId)
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user) return null
    const rows = await db
      .select({ productId: favorites.productId })
      .from(favorites)
      .where(and(eq(favorites.userId, user.id), eq(favorites.productId, data)))
    return rows.length > 0
  })

export const favoriteStatusOptions = (productId: string) =>
  queryOptions({
    queryKey: [...queryKeys.me(), 'favorite', productId],
    queryFn: () => isFavorite({ data: productId }),
    staleTime: 30_000,
  })

export const toggleFavorite = createServerFn({ method: 'POST' })
  .validator((productId: string) => productId)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const existing = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, user.id), eq(favorites.productId, data)))
    if (existing.length > 0) {
      await db
        .delete(favorites)
        .where(
          and(eq(favorites.userId, user.id), eq(favorites.productId, data)),
        )
      return { favorited: false }
    }
    await db.insert(favorites).values({ userId: user.id, productId: data })
    void recordProductEvent(data, 'favorite', user.id)
    return { favorited: true }
  })

export const getFavorites = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        categoryName: categories.name,
        image: productImages.r2Key,
        salePrice: products.salePrice,
        discountPercent: products.discountPercent,
        isRentable: products.isRentable,
        isPreorder: products.isPreorder,
        favoritedAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(products, eq(favorites.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.sort, 0),
        ),
      )
      .where(eq(favorites.userId, user.id))
      .orderBy(desc(favorites.createdAt))

    const grouped = await fetchColors(rows.map((r) => r.id))
    return rows.map((row) => ({
      ...toCard({ ...row, colors: grouped.get(row.id) ?? [] }),
      favoritedAt: row.favoritedAt,
    }))
  },
)

export const favoritesOptions = queryOptions({
  queryKey: [...queryKeys.me(), 'favorites'],
  queryFn: () => getFavorites(),
})

// ── Alamat ───────────────────────────────────────────────────────────────────

export const addressSchema = z.object({
  label: z.string().trim().max(50).nullish(),
  recipient: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(20),
  street: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().length(5),
  isDefault: z.boolean(),
})

export type AddressInput = z.infer<typeof addressSchema>

export const listAddresses = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    return db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))
  },
)

export const addressesOptions = queryOptions({
  queryKey: [...queryKeys.me(), 'addresses'],
  queryFn: () => listAddresses(),
})

export const saveAddress = createServerFn({ method: 'POST' })
  .validator(addressSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (data.isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, user.id))
    }
    const [row] = await db
      .insert(addresses)
      .values({ ...data, userId: user.id })
      .returning()
    return row
  })

export const deleteAddress = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db
      .delete(addresses)
      .where(and(eq(addresses.id, data), eq(addresses.userId, user.id)))
    return { ok: true as const }
  })

// ── Preferensi ───────────────────────────────────────────────────────────────

export const preferenceSchema = z.object({
  categories: z.array(z.string()),
  budgetMin: z.number().int().min(0).nullable(),
  budgetMax: z.number().int().min(0).nullable(),
  partySize: z.number().int().min(1).max(50).nullable(),
  conditions: z.array(z.string()),
  style: z.array(z.string()),
  preferMode: z.enum(['buy', 'rent', 'any']),
})

export type PreferenceInput = z.infer<typeof preferenceSchema>

export const getPreferences = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
    return rows[0] ?? null
  },
)

export const preferencesOptions = queryOptions({
  queryKey: [...queryKeys.me(), 'preferences'],
  queryFn: () => getPreferences(),
})

/**
 * Ringkasan preferensi yang dipakai fitur "Paling cocok untukmu" di katalog.
 * Guest mendapat `authenticated: false` (bukan error) supaya halaman publik
 * tetap bisa menampilkan cold-start/popular dan mengajak masuk.
 */
export type RecommendationProfile =
  | { authenticated: false }
  | {
      authenticated: true
      name: string
      hasPreferences: boolean
      categories: string[]
      budgetMin: number | null
      budgetMax: number | null
      partySize: number | null
      conditions: string[]
      style: string[]
      preferMode: 'buy' | 'rent' | 'any'
      updatedAt: Date | null
    }

export const getRecommendationProfile = createServerFn({
  method: 'GET',
}).handler(async (): Promise<RecommendationProfile> => {
  const user = await getSessionUser()
  if (!user) return { authenticated: false }

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1)

  const categoryRows = prefs?.categories.length
    ? await db
        .select({ name: categories.name })
        .from(categories)
        .where(inArray(categories.id, prefs.categories))
    : []

  const hasPreferences = Boolean(
    prefs &&
    (prefs.categories.length > 0 ||
      prefs.budgetMin != null ||
      prefs.budgetMax != null ||
      prefs.partySize != null ||
      prefs.conditions.length > 0 ||
      prefs.style.length > 0 ||
      prefs.preferMode !== 'any'),
  )

  return {
    authenticated: true,
    name: user.name,
    hasPreferences,
    categories: categoryRows.map((row) => row.name),
    budgetMin: prefs?.budgetMin ?? null,
    budgetMax: prefs?.budgetMax ?? null,
    partySize: prefs?.partySize ?? null,
    conditions: prefs?.conditions ?? [],
    style: prefs?.style ?? [],
    preferMode: prefs?.preferMode ?? 'any',
    updatedAt: prefs?.updatedAt ?? null,
  }
})

export const recommendationProfileOptions = queryOptions({
  queryKey: [...queryKeys.me(), 'recommendation-profile'],
  queryFn: () => getRecommendationProfile(),
  staleTime: 30_000,
})

export const savePreferences = createServerFn({ method: 'POST' })
  .validator(preferenceSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .insert(userPreferences)
      .values({ ...data, userId: user.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()
    return row
  })
