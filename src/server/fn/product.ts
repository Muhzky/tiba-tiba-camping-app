import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { queryOptions } from '@tanstack/react-query'
import { db } from '#/server/db'
import {
  attributes,
  categories,
  productAttributeValues,
  productImages,
  products,
  productVariants,
} from '#/server/db/schema'
import { env } from '#/lib/env'
import { queryKeys } from '#/lib/query-keys'
import { rupiah } from '#/lib/format'
import { getSessionUser } from '#/server/fn/auth'
import { recordProductEvent } from '#/server/recommender/profile'

export function imageUrl(r2Key: string): string {
  if (r2Key.startsWith('local/')) return `/${r2Key.slice('local/'.length)}`
  return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`
}

export type ProductCardData = {
  id: string
  slug: string
  name: string
  category: string
  image: string
  price: number
  priceLabel: string
  discountPercent: number
  salePriceLabel: string | null
  colors: Array<{ name: string; hex: string }>
  isRentable: boolean
  isPreorder: boolean
}

const basePrice = sql<number>`products.sale_price - round(products.sale_price * products.discount_percent / 100.0)`

export function toCard(row: {
  id: string
  slug: string
  name: string
  categoryName: string
  image: string | null
  salePrice: number
  discountPercent: number
  isRentable: boolean
  isPreorder: boolean
  colors: Array<{ name: string; hex: string }>
}): ProductCardData {
  const discounted = Math.round(row.salePrice - (row.salePrice * row.discountPercent) / 100)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.categoryName,
    image: row.image ? imageUrl(row.image) : '/images/placeholder-product.svg',
    price: discounted,
    priceLabel: rupiah(discounted),
    discountPercent: row.discountPercent,
    salePriceLabel: row.discountPercent > 0 ? rupiah(row.salePrice) : null,
    colors: row.colors,
    isRentable: row.isRentable,
    isPreorder: row.isPreorder,
  }
}

const cardQuery = db
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
  })
  .from(products)
  .innerJoin(categories, eq(products.categoryId, categories.id))
  .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.sort, 0)))

export async function fetchColors(
  ids: string[],
): Promise<Map<string, Array<{ name: string; hex: string }>>> {
  const variantRows = ids.length
    ? await db
        .select({
          productId: productVariants.productId,
          colorName: productVariants.colorName,
          colorHex: productVariants.colorHex,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, ids))
    : []

  const grouped = new Map<string, Array<{ name: string; hex: string }>>()
  for (const v of variantRows) {
    if (!v.colorName || !v.colorHex) continue
    const list = grouped.get(v.productId) ?? []
    if (!list.some((c) => c.hex === v.colorHex)) {
      list.push({ name: v.colorName, hex: v.colorHex })
    }
    grouped.set(v.productId, list)
  }
  return grouped
}

async function fetchProductCards(limit: number, newest = false) {
  const rows = await cardQuery
    .where(eq(products.isActive, true))
    .orderBy(newest ? desc(products.createdAt) : desc(basePrice))
    .limit(limit)

  const grouped = await fetchColors(rows.map((r) => r.id))
  return rows.map((row) => toCard({ ...row, colors: grouped.get(row.id) ?? [] }))
}

export async function fetchCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return []
  const rows = await cardQuery.where(inArray(products.id, ids))
  const grouped = await fetchColors(ids)
  const order = new Map(ids.map((id, i) => [id, i]))
  return rows
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((row) => toCard({ ...row, colors: grouped.get(row.id) ?? [] }))
}

export const getBestSellers = createServerFn({ method: 'GET' })
  .handler(async (): Promise<ProductCardData[]> => fetchProductCards(8))

export const getNewArrivals = createServerFn({ method: 'GET' })
  .handler(async (): Promise<ProductCardData[]> => fetchProductCards(8, true))

export const bestSellersOptions = queryOptions({
  queryKey: queryKeys.products.bestSellers(),
  queryFn: () => getBestSellers(),
})

export const newArrivalsOptions = queryOptions({
  queryKey: queryKeys.products.list({ sort: 'baru' }),
  queryFn: () => getNewArrivals(),
})

// Rekomendasi tamu (M7 akan mengganti dengan skor CBF user).
export const getPopular = createServerFn({ method: 'GET' })
  .handler(async (): Promise<ProductCardData[]> => fetchProductCards(8))

export const popularOptions = queryOptions({
  queryKey: queryKeys.products.recommendations(),
  queryFn: () => getPopular(),
})

export const getCategories = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .orderBy(categories.name)
  })

export const categoriesOptions = queryOptions({
  queryKey: queryKeys.katalog.categories(),
  queryFn: () => getCategories(),
})

export type ProductVariantData = {
  id: string
  sku: string
  colorName: string | null
  colorHex: string | null
  size: string | null
  stock: number
}

export type ProductSpec = { name: string; value: string }

export type ProductDetail = ProductCardData & {
  canonicalUrl: string
  salePrice: number
  isSellable: boolean
  description: string
  brandLine: string | null
  rentPricePerDay: number | null
  rentDeposit: number
  isPreorder: boolean
  preorderEta: string | null
  preorderDpPercent: number | null
  categoryName: string
  images: string[]
  variants: ProductVariantData[]
  specs: ProductSpec[]
}

export const getProductDetail = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<ProductDetail | null> => {
    const [row] = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        brandLine: products.brandLine,
        salePrice: products.salePrice,
        discountPercent: products.discountPercent,
        rentPricePerDay: products.rentPricePerDay,
        rentDeposit: products.rentDeposit,
        isRentable: products.isRentable,
        isSellable: products.isSellable,
        isPreorder: products.isPreorder,
        preorderEta: products.preorderEta,
        preorderDpPercent: products.preorderDpPercent,
        categoryName: categories.name,
        image: productImages.r2Key,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        productImages,
        and(eq(productImages.productId, products.id), eq(productImages.sort, 0)),
      )
      .where(and(eq(products.slug, slug), eq(products.isActive, true)))
      .limit(1)

    if (!row) return null

    const viewer = await getSessionUser()
    void recordProductEvent(row.id, 'view', viewer?.id)

    const [variantRows, imageRows, specRows] = await Promise.all([
      db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          colorName: productVariants.colorName,
          colorHex: productVariants.colorHex,
          size: productVariants.size,
          stock: productVariants.stock,
        })
        .from(productVariants)
        .where(eq(productVariants.productId, row.id)),
      db
        .select({ r2Key: productImages.r2Key })
        .from(productImages)
        .where(eq(productImages.productId, row.id))
        .orderBy(productImages.sort),
      db
        .select({
          name: attributes.name,
          value: productAttributeValues.value,
          showInSpec: attributes.showInSpec,
        })
        .from(productAttributeValues)
        .innerJoin(attributes, eq(productAttributeValues.attributeId, attributes.id))
        .where(eq(productAttributeValues.productId, row.id)),
    ])

    const colors: Array<{ name: string; hex: string }> = []
    for (const v of variantRows) {
      if (v.colorName && v.colorHex && !colors.some((c) => c.hex === v.colorHex)) {
        colors.push({ name: v.colorName, hex: v.colorHex })
      }
    }

    const images = [...new Set(imageRows.map((i) => imageUrl(i.r2Key)))]
    const specs: ProductSpec[] = specRows
      .filter((s) => s.showInSpec)
      .map((s) => ({
        name: s.name,
        value:
          typeof s.value === 'string'
            ? s.value
            : typeof s.value === 'number'
              ? String(s.value)
              : JSON.stringify(s.value),
      }))

    return {
      ...toCard({ ...row, categoryName: row.categoryName, colors }),
      canonicalUrl: `${env.APP_URL}/produk/${row.slug}`,
      salePrice: row.salePrice,
      isSellable: row.isSellable,
      description: row.description,
      brandLine: row.brandLine,
      rentPricePerDay: row.rentPricePerDay,
      rentDeposit: row.rentDeposit,
      isPreorder: row.isPreorder,
      preorderEta: row.preorderEta ? row.preorderEta.toISOString() : null,
      preorderDpPercent: row.preorderDpPercent,
      categoryName: row.categoryName,
      images: images.length ? images : ['/images/placeholder-product.svg'],
      variants: variantRows,
      specs,
    }
  })

export const productListOptions = (params: { sort?: 'baru' | 'termurah' } = {}) =>
  queryOptions({
    queryKey: queryKeys.products.list(params),
    queryFn: () => getProducts({ data: params }),
  })

export const getProducts = createServerFn({ method: 'GET' })
  .validator((input: { sort?: 'baru' | 'termurah' } = {}) => input)
  .handler(async ({ data }): Promise<ProductCardData[]> => {
    if (data.sort === 'baru') return fetchProductCards(24, true)
    return fetchProductCards(24)
  })

export const productDetailOptions = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.products.detail(slug),
    queryFn: () => getProductDetail({ data: slug }),
  })
