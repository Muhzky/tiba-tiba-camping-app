import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
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
        .where(and(eq(favorites.userId, user.id), eq(favorites.productId, data)))
      return { favorited: false }
    }
    await db.insert(favorites).values({ userId: user.id, productId: data })
    void recordProductEvent(data, 'favorite', user.id)
    return { favorited: true }
  })

export const getFavorites = createServerFn({ method: 'GET' }).handler(async () => {
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
      and(eq(productImages.productId, products.id), eq(productImages.sort, 0)),
    )
    .where(eq(favorites.userId, user.id))
    .orderBy(desc(favorites.createdAt))

  const grouped = await fetchColors(rows.map((r) => r.id))
  return rows.map((row) => ({
    ...toCard({ ...row, colors: grouped.get(row.id) ?? [] }),
    favoritedAt: row.favoritedAt,
  }))
})

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

export const listAddresses = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))
})

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

export const getPreferences = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
  return rows[0] ?? null
})

export const preferencesOptions = queryOptions({
  queryKey: [...queryKeys.me(), 'preferences'],
  queryFn: () => getPreferences(),
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
