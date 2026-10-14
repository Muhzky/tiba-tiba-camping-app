import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  favorites,
  productEvents,
  productSimilarity,
  productVectors,
  products,
  userProfileVectors,
  users,
} from '#/server/db/schema'
import {
  idfMap,
  logMinmax,
  minmax,
  normalizeWord,
  stem,
  termFreq,
  tokenize,
} from './vectorize'
import { decay, rebuildUserProfile } from './profile'
import { cosine, cosineArrays, rebuildRecommender } from './similarity'
import type { Dictionary } from './vectorize'
import { pickForUser } from '#/server/fn/recommend'
import type { RecCandidate } from '#/server/fn/recommend'

const dict = (over: Partial<Dictionary> = {}): Dictionary => ({
  synonyms: over.synonyms ?? new Map(),
  stopwords: over.stopwords ?? new Set(),
})

describe('vektor teks (murni)', () => {
  it('cosine: identik=1, ortogonal=0, kosong=0', () => {
    expect(cosine({ a: 1, b: 2 }, { a: 1, b: 2 })).toBeCloseTo(1)
    expect(cosine({ a: 1 }, { b: 1 })).toBe(0)
    expect(cosine({}, { a: 1 })).toBe(0)
    expect(cosine({ a: 1 }, {})).toBe(0)
  })

  it('cosineArrays: identik, ortogonal, panjang beda', () => {
    expect(cosineArrays([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
    expect(cosineArrays([1, 0], [0, 1])).toBe(0)
    expect(cosineArrays([1, 0], [1])).toBe(0)
    expect(cosineArrays([], [])).toBe(0)
  })

  it('tokenize: sinonim, stopword, stemming', () => {
    const d = dict({
      synonyms: new Map([['tenda', 'camp']]),
      stopwords: new Set(['yang', 'dan']),
    })
    const out = tokenize('Tenda yang dan berlari cepat', d, 2)
    const byTerm = new Map(out.map((t) => [t.term, t.weight]))
    expect(byTerm.get('camp')).toBe(2)
    expect(byTerm.has('yang')).toBe(false)
    expect(byTerm.has('dan')).toBe(false)
    expect(byTerm.has('lari')).toBe(true)
    expect(normalizeWord('BERAT', dict())).toBe('berat')
    expect(stem('keindahan')).toBe('keindah')
  })

  it('termFreq & idf: bobot terakumulasi, idf dokumen umum = 1', () => {
    const tf = termFreq([
      { term: 'camp', weight: 2 },
      { term: 'camp', weight: 3 },
      { term: 'kompor', weight: 1 },
    ])
    expect(tf.camp).toBe(5)
    const docs = [
      [{ term: 'camp', weight: 1 }, { term: 'kompor', weight: 1 }],
      [{ term: 'camp', weight: 1 }],
      [{ term: 'kompor', weight: 1 }],
    ]
    const idf = idfMap(docs)
    expect(idf.get('camp')).toBeCloseTo(Math.log(4 / 3) + 1)
    expect(idf.get('kompor')).toBeCloseTo(Math.log(4 / 3) + 1)
    expect(idfMap([[{ term: 'a', weight: 1 }]]).get('a')).toBe(1)
  })

  it('normalisasi numerik & decay', () => {
    expect(logMinmax(99, 0, 99)).toBeCloseTo(1)
    expect(logMinmax(0, 0, 99)).toBeCloseTo(0)
    expect(minmax(5, 0, 10)).toBeCloseTo(0.5)
    expect(minmax(5, 5, 5)).toBeCloseTo(0.5)
    expect(decay(0)).toBeCloseTo(1)
    expect(decay(90)).toBeCloseTo(0.5)
  })
})

const cand = (over: Partial<RecCandidate> = {}): RecCandidate => ({
  id: crypto.randomUUID(),
  categoryId: crypto.randomUUID(),
  vector: null,
  active: true,
  isPreorder: false,
  stock: 3,
  soldCount: 0,
  createdAt: new Date('2026-01-01'),
  purchased: false,
  ...over,
})

describe('pickForUser', () => {
  it('filter: stok 0, non-aktif, dan sudah dibeli dibuang; preorder lolos', () => {
    const inStock = cand({ id: 'in', stock: 1 })
    const out = cand({ id: 'out', stock: 0 })
    const preorder = cand({ id: 'pre', stock: 0, isPreorder: true })
    const inactive = cand({ id: 'off', active: false })
    const bought = cand({ id: 'bought', purchased: true })
    const picked = pickForUser({
      profile: null,
      candidates: [inStock, out, preorder, inactive, bought],
      limit: 10,
    })
    expect(picked.map((p) => p.id).sort()).toEqual(['in', 'pre'].sort())
  })

  it('cold start: diurut popularitas lalu terbaru', () => {
    const sold = cand({ id: 'sold', soldCount: 9, createdAt: new Date('2026-01-01') })
    const fresh = cand({ id: 'fresh', soldCount: 0, createdAt: new Date('2026-06-01') })
    const old = cand({ id: 'old', soldCount: 0, createdAt: new Date('2026-02-01') })
    const picked = pickForUser({ profile: null, candidates: [old, fresh, sold], limit: 3 })
    expect(picked.map((p) => p.id)).toEqual(['sold', 'fresh', 'old'])
    expect(picked[0].reason).toBe('popular')
    expect(picked[2].reason).toBe('baru')
  })

  it('diversifikasi: maksimal 3 per kategori', () => {
    const cat = crypto.randomUUID()
    const other = crypto.randomUUID()
    const a = [1, 2, 3, 4].map((i) => cand({ id: `a${i}`, categoryId: cat, soldCount: 10 }))
    const b = cand({ id: 'b', categoryId: other, soldCount: 1 })
    const picked = pickForUser({ profile: null, candidates: [...a, b], limit: 4 })
    expect(picked).toHaveLength(4)
    expect(picked.some((p) => p.id === 'b')).toBe(true)
  })

  it('alasan personal saat profil cocok, popular saat tidak cocok', () => {
    const vec = [1, 0]
    const hit = cand({ id: 'hit', vector: vec, soldCount: 0 })
    const miss = cand({ id: 'miss', vector: [0, 1], soldCount: 5 })
    const picked = pickForUser({ profile: [1, 0], candidates: [miss, hit], limit: 2 })
    expect(picked.find((p) => p.id === 'hit')?.reason).toBe('personal')
    expect(picked.find((p) => p.id === 'miss')?.reason).toBe('popular')
  })
})

describe('rebuild rekomendasi (DB)', () => {
  let testUserId: string
  let favProductId: string
  let otherProductId: string

  beforeAll(async () => {
    await rebuildRecommender()

    const [user] = await db
      .insert(users)
      .values({
        name: 'Profil Uji',
        email: `reco-test-${Date.now()}@tibatibacamping.test`,
        emailVerified: true,
        role: 'customer',
      })
      .returning({ id: users.id })
    testUserId = user.id

    const active = await db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .innerJoin(productVectors, eq(productVectors.productId, products.id))
      .where(eq(products.isActive, true))
      .limit(10)
    const first = active[0]
    const other = active.find((p) => first && p.categoryId !== first.categoryId) ?? active[1]
    if (!first || !other) throw new Error('butuh minimal 2 produk aktif dari seed')
    favProductId = first.id
    otherProductId = other.id
    await db.insert(favorites).values({ userId: testUserId, productId: favProductId })
  })

  afterAll(async () => {
    await db.delete(favorites).where(eq(favorites.userId, testUserId))
    await db.delete(productEvents).where(eq(productEvents.userId, testUserId))
    await db.delete(userProfileVectors).where(eq(userProfileVectors.userId, testUserId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

  it('vektor dibuat untuk semua produk aktif', async () => {
    const [active] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.isActive, true))
    const [vectors] = await db.select({ n: sql<number>`count(*)::int` }).from(productVectors)
    expect(vectors.n).toBeGreaterThan(0)
    expect(vectors.n).toBe(active.n)
  })

  it('pasangan similar terisi dan skornya valid', async () => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(productSimilarity)
    expect(row.n).toBeGreaterThan(0)
    const [bad] = await db
      .select()
      .from(productSimilarity)
      .where(sql`${productSimilarity.score} <= 0 or ${productSimilarity.score} > 1`)
      .limit(1)
    expect(bad).toBeUndefined()
  })

  it('profil pengguna condong ke produk favorit', async () => {
    const ok = await rebuildUserProfile(testUserId)
    expect(ok).toBe(true)
    const [profileRow] = await db
      .select({ vector: userProfileVectors.vector })
      .from(userProfileVectors)
      .where(eq(userProfileVectors.userId, testUserId))
    const vecRows = await db
      .select({ id: productVectors.productId, vector: productVectors.vector })
      .from(productVectors)
    const vecById = new Map(vecRows.map((r) => [r.id, r.vector]))
    const fav = vecById.get(favProductId)
    const other = vecById.get(otherProductId)
    if (!fav || !other) throw new Error('vektor produk uji hilang')
    const toFav = cosineArrays(profileRow.vector, fav)
    const toOther = cosineArrays(profileRow.vector, other)
    expect(toFav).toBeGreaterThan(toOther)
    expect(toFav).toBeGreaterThan(0)
  })
})
