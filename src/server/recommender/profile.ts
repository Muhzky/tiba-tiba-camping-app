import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  categories,
  favorites,
  orderItems,
  orders,
  productEvents,
  productVariants,
  productVectors,
  userPreferences,
  userProfileVectors,
} from '#/server/db/schema'
import { EMPTY_DICTIONARY, buildVectorSpace, logMinmax, minmax, tokenize } from './vectorize'

export const SIGNAL_WEIGHTS = {
  explicit: 1.0,
  buy: 1.0,
  rent: 0.8,
  favorite: 0.7,
  add_cart: 0.4,
  view: 0.2,
} as const

export const HALF_LIFE_DAYS = 90

export function decay(ageDays: number): number {
  return Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS)
}

export type ProductEventType = 'view' | 'add_cart' | 'favorite' | 'purchase'

export async function recordProductEvent(
  productId: string,
  type: ProductEventType,
  userId?: string | null,
): Promise<void> {
  await db.insert(productEvents).values({ productId, type, userId: userId ?? null })
  if (userId) void rebuildUserProfile(userId).catch(() => {})
}

/**
 * Profil = rata-rata berbobot vektor produk (dengan time decay) + preferensi
 * eksplisit yang dipetakan ke ruang vektor yang sama.
 * ponytail: rebuild-on-read (murah untuk skala demo); bila mahal, pindahkan
 * ke event-driven + TTL.
 */
export async function rebuildUserProfile(userId: string): Promise<boolean> {
  const space = await buildVectorSpace()
  const vocabLen = space.vocab.length
  if (!vocabLen) return false
  const indexOf = new Map(space.vocab.map((k, i) => [k, i]))

  const vecRows = await db
    .select({ productId: productVectors.productId, vector: productVectors.vector })
    .from(productVectors)
  const vecById = new Map(vecRows.map((r) => [r.productId, r.vector]))

  const profile = new Array<number>(vocabLen).fill(0)
  const addSparse = (sparse: Record<string, number>, weight: number) => {
    for (const [key, value] of Object.entries(sparse)) {
      const idx = indexOf.get(key)
      if (idx != null) profile[idx] += value * weight
    }
  }
  const addDense = (vec: number[] | undefined, weight: number) => {
    if (!vec || vec.length !== vocabLen) return
    for (let i = 0; i < vocabLen; i++) profile[i] += vec[i] * weight
  }

  const now = Date.now()
  const daysSince = (d: Date) => (now - d.getTime()) / 86_400_000

  const orderRows = await db
    .select({
      productId: productVariants.productId,
      type: orders.type,
      createdAt: orders.createdAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(and(eq(orders.userId, userId), inArray(orders.status, ['completed', 'returned'])))
  for (const row of orderRows) {
    const weight = (row.type === 'rent' ? SIGNAL_WEIGHTS.rent : SIGNAL_WEIGHTS.buy) * decay(daysSince(row.createdAt))
    addDense(vecById.get(row.productId), weight)
  }

  const favRows = await db
    .select({ productId: favorites.productId, createdAt: favorites.createdAt })
    .from(favorites)
    .where(eq(favorites.userId, userId))
  for (const row of favRows) {
    addDense(vecById.get(row.productId), SIGNAL_WEIGHTS.favorite * decay(daysSince(row.createdAt)))
  }

  const eventRows = await db
    .select({ productId: productEvents.productId, type: productEvents.type, createdAt: productEvents.createdAt })
    .from(productEvents)
    .where(and(eq(productEvents.userId, userId), inArray(productEvents.type, ['add_cart', 'view'])))
  for (const row of eventRows) {
    const w = row.type === 'add_cart' ? SIGNAL_WEIGHTS.add_cart : SIGNAL_WEIGHTS.view
    addDense(vecById.get(row.productId), w * decay(daysSince(row.createdAt)))
  }

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)
  if (prefs) {
    const explicit: Record<string, number> = {}
    if (prefs.categories.length) {
      const cats = await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(inArray(categories.id, prefs.categories))
      for (const c of cats) explicit[`c:${c.slug}`] = SIGNAL_WEIGHTS.explicit
    }
    if (prefs.budgetMin != null && prefs.budgetMax != null && space.ranges.price) {
      const mid = (prefs.budgetMin + prefs.budgetMax) / 2
      explicit['n:price'] = logMinmax(mid, space.ranges.price.min, space.ranges.price.max)
    }
    if (prefs.partySize != null) {
      const range = space.ranges.numericAttrs.get('kapasitas_orang')
      if (range) {
        explicit['n:attr:kapasitas_orang'] =
          minmax(prefs.partySize, range.min, range.max) * SIGNAL_WEIGHTS.explicit
      }
    }
    // kondisi/gaya dipetakan lewat kata yang sama dengan deskripsi produk;
    // kunci yang tidak ada di kosakata produk otomatis diabaikan
    const words = [...prefs.conditions, ...prefs.style]
    const terms = tokenize(words.join(' '), EMPTY_DICTIONARY, SIGNAL_WEIGHTS.explicit)
    for (const t of terms) explicit[`t:${t.term}`] = (explicit[`t:${t.term}`] ?? 0) + t.weight
    addSparse(explicit, 1)
  }

  const hasSignal = profile.some((v) => v !== 0)
  if (!hasSignal) {
    await db.delete(userProfileVectors).where(eq(userProfileVectors.userId, userId))
    return false
  }
  await db
    .insert(userProfileVectors)
    .values({ userId, vector: profile, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userProfileVectors.userId,
      set: { vector: profile, updatedAt: new Date() },
    })
  return true
}

export async function getUserProfile(userId: string): Promise<number[] | null> {
  const rebuilt = await rebuildUserProfile(userId)
  if (!rebuilt) return null
  const [row] = await db
    .select({ vector: userProfileVectors.vector })
    .from(userProfileVectors)
    .where(eq(userProfileVectors.userId, userId))
    .limit(1)
  return row?.vector ?? null
}
