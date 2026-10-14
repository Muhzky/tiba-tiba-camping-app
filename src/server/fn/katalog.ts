import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  or,
  sql
  
} from 'drizzle-orm'
import type {SQL} from 'drizzle-orm';
import { db } from '#/server/db'
import {
  attributes,
  categories,
  dictionaryTerms,
  productAttributeValues,
  products,
  productVariants,
} from '#/server/db/schema'
import {
  KATALOG_PAGE_SIZE,
  katalogSearchSchema,
  splitCsv,
  transactionModes
  
  
} from '#/lib/katalog-schema'
import type {KatalogSearch, TransactionMode} from '#/lib/katalog-schema';
import { queryKeys } from '#/lib/query-keys'
import { fetchCardsByIds, fetchColors, toCard } from './product'
import { getSessionUser } from './auth'
import { rankActiveProductIds, similarProductIds } from './recommend'
import type {ProductCardData} from './product';

const discountedPrice = sql`products.sale_price - round(products.sale_price * products.discount_percent / 100.0)`
const esc = (v: string) => v.replace(/[\\%_]/g, '\\$&')

async function expandSearchTerms(q: string): Promise<string[]> {
  const raw = q
    .toLowerCase()
    .split(/\\s+/)
    .map((t) => t.trim())
    .filter(Boolean)

  if (raw.length === 0) return []

  const dict = await db
    .select({
      term: dictionaryTerms.term,
      canonical: dictionaryTerms.canonical,
      kind: dictionaryTerms.kind,
    })
    .from(dictionaryTerms)

  const stopwords = new Set(dict.filter((d) => d.kind === 'stopword').map((d) => d.term.toLowerCase()))
  const synonyms = new Map<string, string>()
  for (const d of dict) {
    if (d.kind !== 'synonym') continue
    synonyms.set(d.term.toLowerCase(), d.canonical.toLowerCase())
    synonyms.set(d.canonical.toLowerCase(), d.canonical.toLowerCase())
  }

  const terms = new Set<string>()
  for (const token of raw) {
    if (stopwords.has(token)) continue
    terms.add(token)
    const canonical = synonyms.get(token)
    if (canonical) terms.add(canonical)
  }
  return [...terms].slice(0, 12)
}

function attributeExists(attributeId: string, condition: SQL): SQL {
  return sql`exists (
    select 1 from product_attribute_values pav
    where pav.product_id = products.id
      and pav.attribute_id = ${attributeId}
      and ${condition}
  )`
}

export type KatalogResult = {
  items: ProductCardData[]
  total: number
  page: number
  pageSize: number
}

export const searchProducts = createServerFn({ method: 'GET' })
  .validator((input: KatalogSearch) => katalogSearchSchema.parse(input))
  .handler(async ({ data: input }): Promise<KatalogResult> => {
    const f = input
    const kategori = splitCsv(f.kategori)
    const tipe = splitCsv(f.tipe)?.filter((t): t is TransactionMode =>
      (transactionModes as readonly string[]).includes(t),
    )
    const kapasitas = splitCsv(f.kapasitas)
      ?.map(Number)
      .filter((n) => Number.isFinite(n))
    const musim = splitCsv(f.musim)
    const bahan = splitCsv(f.bahan)
    const warna = splitCsv(f.warna)

    const conds: SQL[] = [eq(products.isActive, true)]

    if (kategori?.length) conds.push(inArray(categories.slug, kategori))

    if (tipe?.length) {
      const modeConds = tipe.map((t) =>
        t === 'beli'
          ? eq(products.isSellable, true)
          : t === 'sewa'
            ? eq(products.isRentable, true)
            : eq(products.isPreorder, true),
      )
      conds.push(or(...modeConds)!)
    }

    const priceExpr = tipe?.length === 1 && tipe[0] === 'sewa' ? products.rentPricePerDay : discountedPrice
    if (f.harga_min !== undefined) conds.push(sql`${priceExpr} >= ${f.harga_min}`)
    if (f.harga_max !== undefined) conds.push(sql`${priceExpr} <= ${f.harga_max}`)

    const attrKeys = ['kapasitas_orang', 'musim', 'bahan', 'berat_kg'].filter((key) => {
      if (key === 'kapasitas_orang') return Boolean(kapasitas?.length)
      if (key === 'musim') return Boolean(musim?.length)
      if (key === 'bahan') return Boolean(bahan?.length)
      return f.berat_max !== undefined
    })
    const attrRows = attrKeys.length
      ? await db
          .select({ id: attributes.id, key: attributes.key })
          .from(attributes)
          .where(inArray(attributes.key, attrKeys))
      : []
    const attrByKey = new Map(attrRows.map((a) => [a.key, a.id]))

    if (kapasitas?.length) {
      const id = attrByKey.get('kapasitas_orang')
      if (id) {
        const values = sql.join(kapasitas.map((n) => sql`${n}`), sql`, `)
        conds.push(attributeExists(id, sql`(pav.value #>> '{}')::numeric in (${values})`))
      }
    }
    if (musim?.length) {
      const id = attrByKey.get('musim')
      if (id) {
        const values = sql.join(musim.map((v) => sql`${v}`), sql`, `)
        conds.push(attributeExists(id, sql`(pav.value #>> '{}') in (${values})`))
      }
    }
    if (bahan?.length) {
      const id = attrByKey.get('bahan')
      if (id) {
        const values = sql.join(bahan.map((v) => sql`${v}`), sql`, `)
        conds.push(attributeExists(id, sql`(pav.value #>> '{}') in (${values})`))
      }
    }
    if (f.berat_max !== undefined) {
      const id = attrByKey.get('berat_kg')
      if (id) conds.push(attributeExists(id, sql`(pav.value #>> '{}')::numeric <= ${f.berat_max}`))
    }
    if (warna?.length) {
      const values = sql.join(warna.map((v) => sql`${v}`), sql`, `)
      conds.push(sql`exists (
        select 1 from product_variants pv
        where pv.product_id = products.id and pv.color_name in (${values})
      )`)
    }
    if (f.tersedia) {
      conds.push(sql`coalesce(
        (select sum(pv.stock) from product_variants pv where pv.product_id = products.id), 0
      ) > 0`)
    }
    if (f.diskon) conds.push(gt(products.discountPercent, 0))

    if (f.q) {
      const terms = await expandSearchTerms(f.q)
      if (terms.length) {
        const termConds = terms.map((t) =>
          or(
            ilike(products.name, `%${esc(t)}%`),
            ilike(products.description, `%${esc(t)}%`),
            ilike(categories.name, `%${esc(t)}%`),
          ),
        )
        conds.push(or(...termConds)!)
      }
    }

    const where = and(...conds)

    const [totalRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where)

    const total = totalRow?.total ?? 0
    const page = f.halaman
    const offset = (page - 1) * KATALOG_PAGE_SIZE

    const rankedIds =
      f.sort === 'relevan'
        ? await (async () => {
            const user = await getSessionUser()
            return rankActiveProductIds(user?.id ?? null)
          })()
        : []

    const relevanExpr = sql`array_position(
      array[${sql.join(rankedIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[],
      ${products.id}
    )`
    const orderBy =
      f.sort === 'harga-naik'
        ? asc(priceExpr)
        : f.sort === 'harga-turun'
          ? desc(priceExpr)
          : f.sort === 'relevan'
            ? relevanExpr
            : desc(products.createdAt)

    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        categoryName: categories.name,
        salePrice: products.salePrice,
        discountPercent: products.discountPercent,
        isRentable: products.isRentable,
        isPreorder: products.isPreorder,
        image: sql<string | null>`(
          select pi.r2_key from product_images pi
          where pi.product_id = products.id order by pi.sort limit 1
        )`,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(orderBy)
      .limit(KATALOG_PAGE_SIZE)
      .offset(offset)

    const colors = await fetchColors(rows.map((r) => r.id))
    const items = rows.map((row) => toCard({ ...row, colors: colors.get(row.id) ?? [] }))

    return { items, total, page, pageSize: KATALOG_PAGE_SIZE }
  })

export const katalogQueryOptions = (filters: KatalogSearch) =>
  queryOptions({
    queryKey: queryKeys.products.list(filters as Record<string, unknown>),
    queryFn: () => searchProducts({ data: filters }),
  })

export const getRelatedProducts = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<ProductCardData[]> => {
    const [product] = await db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1)
    if (!product) return []

    const similarIds = await similarProductIds(product.id, 4)
    if (similarIds.length) return fetchCardsByIds(similarIds)

    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        categoryName: categories.name,
        salePrice: products.salePrice,
        discountPercent: products.discountPercent,
        isRentable: products.isRentable,
        isPreorder: products.isPreorder,
        image: sql<string | null>`(
          select pi.r2_key from product_images pi
          where pi.product_id = products.id order by pi.sort limit 1
        )`,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.isActive, true), eq(products.categoryId, product.categoryId), sql`products.id <> ${product.id}`))
      .limit(4)

    const colors = await fetchColors(rows.map((r) => r.id))
    return rows.map((row) => toCard({ ...row, colors: colors.get(row.id) ?? [] }))
  })

export const relatedProductsOptions = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.products.list({ related: slug }),
    queryFn: () => getRelatedProducts({ data: slug }),
  })

export type KatalogFacets = {
  categories: Array<{ name: string; slug: string }>
  musim: string[]
  bahan: string[]
  kapasitas: number[]
  warna: string[]
}

export const getKatalogFacets = createServerFn({ method: 'GET' }).handler(
  async (): Promise<KatalogFacets> => {
    const [categoryRows, attributeRows, colorRows] = await Promise.all([
      db
        .select({ name: categories.name, slug: categories.slug })
        .from(categories)
        .orderBy(categories.name),
      db
        .select({ key: attributes.key, value: productAttributeValues.value })
        .from(productAttributeValues)
        .innerJoin(attributes, eq(productAttributeValues.attributeId, attributes.id))
        .where(inArray(attributes.key, ['musim', 'bahan', 'kapasitas_orang'])),
      db
        .selectDistinct({ colorName: sql<string>`color_name` })
        .from(productVariants)
        .where(sql`color_name is not null and exists (
          select 1 from products p where p.id = product_variants.product_id and p.is_active
        )`),
    ])

    const parseValue = (v: unknown): string | number | null =>
      typeof v === 'string' || typeof v === 'number' ? v : null

    const pick = (key: string) =>
      attributeRows
        .filter((r) => r.key === key)
        .map((r) => parseValue(r.value))
        .filter((v): v is string | number => v !== null)

    const musim = [...new Set(pick('musim').map(String))]
    const bahan = [...new Set(pick('bahan').map(String))]
    const kapasitas = [...new Set(pick('kapasitas_orang').map(Number).filter(Number.isFinite))].sort(
      (a, b) => a - b,
    )
    const warna = [...new Set(colorRows.map((r) => r.colorName).filter(Boolean))]

    return { categories: categoryRows, musim, bahan, kapasitas, warna }
  },
)

export const katalogFacetsOptions = queryOptions({
  queryKey: queryKeys.katalog.facets(),
  queryFn: () => getKatalogFacets(),
})
