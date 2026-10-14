import { eq, notInArray, sql } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  attributes,
  categories,
  dictionaryTerms,
  productAttributeValues,
  productVectors,
  products,
} from '#/server/db/schema'

export type SparseVec = Record<string, number>
export type WeightedTerm = { term: string; weight: number }
export type Dictionary = { synonyms: Map<string, string>; stopwords: Set<string> }

export const EMPTY_DICTIONARY: Dictionary = { synonyms: new Map(), stopwords: new Set() }

// ponytail: stemming ringan (prefix/suffix umum Indonesia) — bukan stemmer penuh;
// ganti dengan lib stemmer bila kualitas rekomendasi kurang.
export function stem(word: string): string {
  let w = word
  if (w.length > 6 && /^(mem|men|meny|meng|me|di|ber|ter|pe|per)/.test(w)) {
    w = w.replace(/^(mem|men|meny|meng|me|di|ber|ter|pe|per)/, '')
  }
  if (w.length > 5 && w.endsWith('kan')) w = w.slice(0, -3)
  else if (w.length > 5 && w.endsWith('nya')) w = w.slice(0, -3)
  else if (w.length > 5 && w.endsWith('an')) w = w.slice(0, -2)
  return w
}

export function normalizeWord(raw: string, dict: Dictionary): string | null {
  const lower = raw.toLowerCase()
  if (!lower || dict.stopwords.has(lower)) return null
  const mapped = dict.synonyms.get(lower) ?? lower
  if (dict.stopwords.has(mapped)) return null
  return stem(mapped)
}

export function tokenize(text: string, dict: Dictionary, weight = 1): WeightedTerm[] {
  const out: WeightedTerm[] = []
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    const term = normalizeWord(raw, dict)
    if (term && term.length > 1) out.push({ term, weight })
  }
  return out
}

export function termFreq(terms: WeightedTerm[]): SparseVec {
  const tf: SparseVec = {}
  for (const t of terms) tf[t.term] = (tf[t.term] ?? 0) + t.weight
  return tf
}

export function idfMap(docs: WeightedTerm[][]): Map<string, number> {
  const df = new Map<string, number>()
  for (const doc of docs) {
    for (const term of new Set(doc.map((t) => t.term))) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const idf = new Map<string, number>()
  const n = docs.length
  for (const [term, count] of df) idf.set(term, Math.log((1 + n) / (1 + count)) + 1)
  return idf
}

export function logMinmax(value: number, min: number, max: number): number {
  const lo = Math.log(min + 1)
  const hi = Math.log(max + 1)
  if (hi === lo) return 0.5
  return Math.min(1, Math.max(0, (Math.log(value + 1) - lo) / (hi - lo)))
}

export function minmax(value: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

export function toDense(vocab: string[], sparse: SparseVec): number[] {
  const dense = new Array<number>(vocab.length)
  for (let i = 0; i < vocab.length; i++) dense[i] = sparse[vocab[i]] ?? 0
  return dense
}

export async function loadDictionary(): Promise<Dictionary> {
  const rows = await db
    .select({ term: dictionaryTerms.term, canonical: dictionaryTerms.canonical, kind: dictionaryTerms.kind })
    .from(dictionaryTerms)
  const dict: Dictionary = { synonyms: new Map(), stopwords: new Set() }
  for (const row of rows) {
    if (row.kind === 'synonym') dict.synonyms.set(row.term.toLowerCase(), row.canonical.toLowerCase())
    else if (row.kind === 'stopword') dict.stopwords.add(row.term.toLowerCase())
  }
  return dict
}

type NumRange = { min: number; max: number }

export type VectorSpace = {
  vocab: string[]
  vectors: Map<string, SparseVec>
  ranges: {
    price: NumRange | null
    rent: NumRange | null
    numericAttrs: Map<string, NumRange>
  }
}

type ActiveProduct = {
  id: string
  name: string
  description: string | null
  brandLine: string | null
  categoryId: string
  categorySlug: string
  categoryName: string
  salePrice: number
  rentPricePerDay: number | null
  rentDeposit: number
}

export async function buildVectorSpace(): Promise<VectorSpace> {
  const dict = await loadDictionary()
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      brandLine: products.brandLine,
      categoryId: products.categoryId,
      categorySlug: categories.slug,
      categoryName: categories.name,
      salePrice: products.salePrice,
      rentPricePerDay: products.rentPricePerDay,
      rentDeposit: products.rentDeposit,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true))
  const prods: ActiveProduct[] = rows

  const attrDefs = await db
    .select({ id: attributes.id, key: attributes.key, type: attributes.type, weight: attributes.weight })
    .from(attributes)
  const attrById = new Map(attrDefs.map((a) => [a.id, a]))
  const numericKeys = attrDefs.filter((a) => a.type === 'number').map((a) => a.key)

  const values = await db
    .select({
      productId: productAttributeValues.productId,
      attributeId: productAttributeValues.attributeId,
      value: productAttributeValues.value,
    })
    .from(productAttributeValues)
  const valuesByProduct = new Map<string, typeof values>()
  for (const v of values) {
    const list = valuesByProduct.get(v.productId) ?? []
    list.push(v)
    valuesByProduct.set(v.productId, list)
  }

  // ranges (untuk fitur numerik & pemetaan preferensi eksplisit)
  const prices = prods.map((p) => p.salePrice)
  const rents = prods.flatMap((p) => (p.rentPricePerDay != null ? [p.rentPricePerDay] : []))
  const priceRange: NumRange | null = prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : null
  const rentRange: NumRange | null = rents.length
    ? { min: Math.min(...rents), max: Math.max(...rents) }
    : null
  const numericAttrs = new Map<string, NumRange>()
  for (const key of numericKeys) {
    const nums: number[] = []
    for (const [productId, list] of valuesByProduct) {
      if (!prods.some((p) => p.id === productId)) continue
      for (const v of list) {
        const def = attrById.get(v.attributeId)
        if (def?.key === key && typeof v.value === 'number') nums.push(v.value)
      }
    }
    if (nums.length) numericAttrs.set(key, { min: Math.min(...nums), max: Math.max(...nums) })
  }

  // dokumen teks per produk (nama + deskripsi + brand + kategori + nilai atribut teks/enum)
  const docs: WeightedTerm[][] = []
  const docOf = new Map<string, WeightedTerm[]>()
  for (const p of prods) {
    const base = [p.name, p.description ?? '', p.brandLine ?? '', p.categoryName].join(' ')
    const terms = tokenize(base, dict, 1)
    for (const v of valuesByProduct.get(p.id) ?? []) {
      const def = attrById.get(v.attributeId)
      if (!def) continue
      if (def.type === 'text' || def.type === 'enum') {
        terms.push(...tokenize(String(v.value ?? ''), dict, def.weight))
      }
    }
    docs.push(terms)
    docOf.set(p.id, terms)
  }
  const idf = idfMap(docs)

  const vectors = new Map<string, SparseVec>()
  for (const p of prods) {
    const sparse: SparseVec = {}
    const tf = termFreq(docOf.get(p.id) ?? [])
    for (const [term, freq] of Object.entries(tf)) sparse[`t:${term}`] = freq * (idf.get(term) ?? 1)
    sparse[`c:${p.categorySlug}`] = 1

    if (priceRange) sparse['n:price'] = logMinmax(p.salePrice, priceRange.min, priceRange.max)
    if (p.rentPricePerDay != null && rentRange) {
      sparse['n:rent'] = logMinmax(p.rentPricePerDay, rentRange.min, rentRange.max)
    }
    if (p.rentDeposit > 0 && prices.length) {
      sparse['n:deposit'] = logMinmax(p.rentDeposit, 0, Math.max(...prices))
    }

    for (const v of valuesByProduct.get(p.id) ?? []) {
      const def = attrById.get(v.attributeId)
      if (!def || def.type !== 'number' || typeof v.value !== 'number') continue
      const range = numericAttrs.get(def.key)
      if (!range) continue
      sparse[`n:attr:${def.key}`] = minmax(v.value, range.min, range.max) * def.weight
    }
    vectors.set(p.id, sparse)
  }

  const keySet = new Set<string>()
  for (const sparse of vectors.values()) for (const key of Object.keys(sparse)) keySet.add(key)
  const vocab = [...keySet].sort()

  return { vocab, vectors, ranges: { price: priceRange, rent: rentRange, numericAttrs } }
}

export async function rebuildProductVectors(): Promise<{ count: number; vocabSize: number }> {
  const space = await buildVectorSpace()
  const activeIds = [...space.vectors.keys()]
  for (const [productId, sparse] of space.vectors) {
    const dense = toDense(space.vocab, sparse)
    await db
      .insert(productVectors)
      .values({ productId, vector: dense })
      .onConflictDoUpdate({
        target: productVectors.productId,
        set: {
          vector: dense,
          version: sql`greatest(${productVectors.version} + 1, 1)`,
          updatedAt: new Date(),
        },
      })
  }
  if (activeIds.length) {
    await db.delete(productVectors).where(notInArray(productVectors.productId, activeIds))
  } else {
    await db.delete(productVectors)
  }
  return { count: activeIds.length, vocabSize: space.vocab.length }
}
