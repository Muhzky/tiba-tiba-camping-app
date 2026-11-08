/**
 * Seeder demo produk — 5 produk, masing-masing dengan gambar contoh sendiri.
 *
 * Jalankan:  npm run db:seed:produk-demo
 *   - Default: sisip 5 produk demo secara idempoten (slug sama dilewati).
 *   - `--clean`: bersihkan dulu seluruh data produk (varian, gambar, unit sewa
 *     ikut cascade) supaya katalog hanya berisi 5 produk demo ini.
 */
import { hashPassword } from 'better-auth/crypto'
import { count, eq } from 'drizzle-orm'
import { db } from './index'
import {
  attributes,
  categories,
  productAttributeValues,
  productImages,
  products,
  productVariants,
  rentalUnits,
  users,
} from './schema'
import { slugify } from '#/lib/format'

/** r2Key 'local/images/<file>' dilayani dari public/images/<file> (lihat imageUrl). */
const IMG = (file: string) => `local/images/${file}`

type DemoProduct = {
  name: string
  category: string
  image: string
  brand: string
  salePrice: number
  discount?: number
  rentPricePerDay?: number
  rentDeposit?: number
  description: string
  attrs?: Record<string, string | number | boolean>
  colors?: Array<[string, string]>
}

const demoProducts: DemoProduct[] = [
  {
    name: 'Tenda Dome 4 Orang Double Layer',
    category: 'tenda',
    image: IMG('produk-tenda-dome-4p.svg'),
    brand: 'Tiba Tiba Camping',
    salePrice: 1_850_000,
    discount: 10,
    rentPricePerDay: 75_000,
    rentDeposit: 300_000,
    description:
      'Tenda dome double layer untuk 4 orang, tahan hujan deras, cepat dipasang. Cocok untuk kemah keluarga.',
    attrs: {
      kapasitas_orang: 4,
      berat_kg: 4.2,
      musim: '3-musim',
      bahan: 'Polyester 190T',
    },
    colors: [
      ['Hitam', '#111111'],
      ['Abu', '#6B7280'],
    ],
  },
  {
    name: 'Sleeping Bag Mummy Hangat -5C',
    category: 'sleeping-bag',
    image: IMG('produk-sleeping-bag-mummy.svg'),
    brand: 'Tiba Tiba Camping',
    salePrice: 780_000,
    discount: 15,
    rentPricePerDay: 35_000,
    rentDeposit: 150_000,
    description:
      'Sleeping bag model mummy isi bulu sintetis, nyaman sampai suhu -5°C.',
    attrs: { suhu_min_c: -5, berat_kg: 1.3, bahan: 'Polar Lining' },
    colors: [['Hijau', '#3F6212']],
  },
  {
    name: 'Kompor Gas Portable Butane',
    category: 'kompor',
    image: IMG('produk-kompor-portable.svg'),
    brand: 'Tiba Tiba Camping',
    salePrice: 320_000,
    rentPricePerDay: 20_000,
    rentDeposit: 75_000,
    description:
      'Kompor gas portable ringkas dengan piezo igniter, nyala cepat, cocok untuk solo camping.',
    attrs: { berat_kg: 0.4, bahan: 'Aluminium' },
    colors: [['Hitam', '#111111']],
  },
  {
    name: 'Carrier Ekspedisi 60L',
    category: 'carrier',
    image: IMG('produk-carrier-60l.svg'),
    brand: 'Tiba Tiba Camping',
    salePrice: 1_250_000,
    discount: 5,
    rentPricePerDay: 60_000,
    rentDeposit: 250_000,
    description:
      'Carrier 60 liter frame internal, rain cover, belt kompresi ganda untuk expedition.',
    attrs: { kapasitas_liter: 60, berat_kg: 1.9, bahan: 'Polyester 600D' },
    colors: [
      ['Hitam', '#111111'],
      ['Hijau', '#3F6212'],
    ],
  },
  {
    name: 'Matras Gulung EVA Foam',
    category: 'matras',
    image: IMG('produk-matras-foam.svg'),
    brand: 'Tiba Tiba Camping',
    salePrice: 185_000,
    rentPricePerDay: 12_000,
    rentDeposit: 50_000,
    description:
      'Matras gulung EVA foam ringan dengan pola gelombang, isolasi baik dan mudah dibawa.',
    attrs: { berat_kg: 0.5, bahan: 'EVA Foam' },
    colors: [['Abu', '#6B7280']],
  },
]

const demoCategories = [
  { name: 'Tenda', slug: 'tenda' },
  { name: 'Sleeping Bag', slug: 'sleeping-bag' },
  { name: 'Kompor', slug: 'kompor' },
  { name: 'Carrier', slug: 'carrier' },
  { name: 'Matras', slug: 'matras' },
]

const demoAttributes = [
  {
    name: 'Kapasitas Orang',
    key: 'kapasitas_orang',
    type: 'number' as const,
    weight: 1.2,
  },
  { name: 'Berat (kg)', key: 'berat_kg', type: 'number' as const, weight: 1.0 },
  { name: 'Musim', key: 'musim', type: 'enum' as const, weight: 1.1 },
  { name: 'Bahan', key: 'bahan', type: 'text' as const, weight: 0.8 },
  {
    name: 'Kapasitas (L)',
    key: 'kapasitas_liter',
    type: 'number' as const,
    weight: 1.0,
  },
  {
    name: 'Suhu Minimum (°C)',
    key: 'suhu_min_c',
    type: 'number' as const,
    weight: 1.1,
  },
]

const argClean = process.argv.includes('--clean')

async function seedDemoProducts() {
  // Akun demo (dipakai juga oleh seeder utama) — aman diulang.
  const password = await hashPassword('password123')
  await db
    .insert(users)
    .values({
      name: 'Admin Operasional',
      email: 'admin@tibatibacamping.test',
      passwordHash: password,
      role: 'admin',
      emailVerified: true,
    })
    .onConflictDoNothing()

  // Kategori & atribut demo — idempoten.
  await db.insert(categories).values(demoCategories).onConflictDoNothing()
  const categoryRows = await db.select().from(categories)
  const categoryBySlug = new Map(categoryRows.map((c) => [c.slug, c.id]))
  for (const slug of demoProducts.map((p) => p.category)) {
    if (!categoryBySlug.has(slug))
      throw new Error(`Kategori demo tidak ditemukan: ${slug}`)
  }

  await db.insert(attributes).values(demoAttributes).onConflictDoNothing()
  const attrRows = await db.select().from(attributes)
  const attrByKey = new Map(attrRows.map((a) => [a.key, a.id]))

  if (argClean) {
    await db.delete(products)
    console.log('Data produk lama dibersihkan (--clean).')
  }

  let inserted = 0
  for (const p of demoProducts) {
    const slug = slugify(p.name)
    const [product] = await db
      .insert(products)
      .values({
        categoryId: categoryBySlug.get(p.category)!,
        name: p.name,
        slug,
        description: p.description,
        brandLine: p.brand,
        salePrice: p.salePrice,
        discountPercent: p.discount ?? 0,
        rentPricePerDay: p.rentPricePerDay ?? null,
        rentDeposit: p.rentDeposit ?? 0,
        isSellable: true,
        isRentable: Boolean(p.rentPricePerDay),
      })
      .onConflictDoNothing()
      .returning()

    if (!product) {
      console.log(`Lewati (sudah ada): ${p.name}`)
      continue
    }
    inserted += 1

    let firstVariantId: string | null = null
    for (const [i, [colorName, colorHex]] of (
      p.colors ?? [['Hitam', '#111111']]
    ).entries()) {
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: `${slug.toUpperCase().replace(/-/g, '')}-${i + 1}`,
          colorName,
          colorHex,
          stock: 10,
        })
        .returning()
      if (i === 0) firstVariantId = variant?.id ?? null

      if (p.rentPricePerDay && variant) {
        await db.insert(rentalUnits).values(
          Array.from({ length: 3 }, (_, u) => ({
            variantId: variant.id,
            serialCode: `${slug.toUpperCase().replace(/-/g, '')}-${i + 1}-${u + 1}`,
            condition: 'good',
          })),
        )
      }
    }

    // Gambar contoh produk (satu, urut paling atas; variantId boleh kosong
    // supaya gambar tampil untuk semua varian warna).
    await db.insert(productImages).values({
      productId: product.id,
      variantId: firstVariantId,
      r2Key: p.image,
      sort: 0,
      alt: p.name,
    })

    for (const [key, value] of Object.entries(p.attrs ?? {})) {
      const attributeId = attrByKey.get(key)
      if (!attributeId) continue
      await db
        .insert(productAttributeValues)
        .values({ productId: product.id, attributeId, value })
        .onConflictDoNothing()
    }
  }

  const [total] = await db
    .select({ n: count() })
    .from(products)
    .where(eq(products.isActive, true))
  console.log(
    `Seeder produk demo selesai: ${inserted} produk baru dimasukkan, total ${Number(total?.n ?? 0)} produk aktif.`,
  )
}

seedDemoProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
