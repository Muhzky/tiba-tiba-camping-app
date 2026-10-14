import { hashPassword } from 'better-auth/crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from './index'
import {
  accounts,
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

const IMG = 'local/images/placeholder-product.svg'

const seedCategories = [
  { name: 'Tenda', slug: 'tenda' },
  { name: 'Sleeping Bag', slug: 'sleeping-bag' },
  { name: 'Kompor', slug: 'kompor' },
  { name: 'Carrier', slug: 'carrier' },
  { name: 'Matras', slug: 'matras' },
  { name: 'Lampu', slug: 'lampu' },
  { name: 'Aksesori Tenda', slug: 'aksesori-tenda' },
]

const seedAttributes = [
  { name: 'Kapasitas Orang', key: 'kapasitas_orang', type: 'number' as const, weight: 1.2 },
  { name: 'Berat (kg)', key: 'berat_kg', type: 'number' as const, weight: 1.0 },
  { name: 'Musim', key: 'musim', type: 'enum' as const, weight: 1.1 },
  { name: 'Bahan', key: 'bahan', type: 'text' as const, weight: 0.8 },
  { name: 'Kapasitas (L)', key: 'kapasitas_liter', type: 'number' as const, weight: 1.0 },
  { name: 'Suhu Minimum (°C)', key: 'suhu_min_c', type: 'number' as const, weight: 1.1 },
]

type SeedProduct = {
  name: string
  category: string
  salePrice: number
  discount?: number
  rentPricePerDay?: number
  rentDeposit?: number
  isPreorder?: boolean
  preorderDpPercent?: number
  description: string
  attrs?: Record<string, string | number | boolean>
  colors?: Array<[string, string]>
}

const seedProducts: SeedProduct[] = [
  {
    name: 'Tenda Dome 4 Orang',
    category: 'tenda',
    salePrice: 1_850_000,
    discount: 10,
    rentPricePerDay: 75_000,
    rentDeposit: 300_000,
    description:
      'Tenda dome untuk 4 orang, double layer, tahan hujan deras. Cocok untuk kemah keluarga.',
    attrs: { kapasitas_orang: 4, berat_kg: 4.2, musim: '3-musim', bahan: 'Polyester 190T' },
    colors: [
      ['Hitam', '#111111'],
      ['Abu', '#6B7280'],
    ],
  },
  {
    name: 'Tenda Tunnel 6 Orang',
    category: 'tenda',
    salePrice: 3_200_000,
    rentPricePerDay: 120_000,
    rentDeposit: 500_000,
    description: 'Tenda tunnel ruang besar untuk 6 orang, dua ruang, cocok untuk expedition.',
    attrs: { kapasitas_orang: 6, berat_kg: 7.8, musim: '4-musim', bahan: 'Ripstop 210D' },
    colors: [['Hitam', '#111111']],
  },
  {
    name: 'Tenda Ultralight 2 Orang',
    category: 'tenda',
    salePrice: 2_450_000,
    rentPricePerDay: 95_000,
    rentDeposit: 400_000,
    description: 'Tenda trekking 2 orang berat minimal, single wall, cepat dipasang.',
    attrs: { kapasitas_orang: 2, berat_kg: 1.6, musim: '3-musim', bahan: 'Silnylon 20D' },
    colors: [
      ['Hitam', '#111111'],
      ['Biru', '#457AA0'],
    ],
  },
  {
    name: 'Sleeping Bag Hangat -5C',
    category: 'sleeping-bag',
    salePrice: 780_000,
    discount: 15,
    rentPricePerDay: 35_000,
    rentDeposit: 150_000,
    description: 'Sleeping bag isi bulu sintetis, nyaman sampai suhu -5°C.',
    attrs: { suhu_min_c: -5, berat_kg: 1.3, bahan: 'Polar Lining' },
    colors: [['Hitam', '#111111']],
  },
  {
    name: 'Sleeping Bag Kompresi Ultralight',
    category: 'sleeping-bag',
    salePrice: 520_000,
    rentPricePerDay: 25_000,
    rentDeposit: 100_000,
    description: 'Sleeping bag ringkas, mudah dikompres, pas untuk trekking ringan.',
    attrs: { suhu_min_c: 5, berat_kg: 0.8, bahan: 'Ripstop 20D' },
    colors: [['Abu', '#6B7280']],
  },
  {
    name: 'Kompor Portable Gas',
    category: 'kompor',
    salePrice: 320_000,
    rentPricePerDay: 20_000,
    rentDeposit: 75_000,
    description: 'Kompor portable ringkas, nyala cepat, cocok untuk solo camping.',
    attrs: { berat_kg: 0.4, bahan: 'Aluminium' },
    colors: [['Hitam', '#111111']],
  },
  {
    name: 'Kompor Double Burner',
    category: 'kompor',
    salePrice: 650_000,
    description: 'Kompor dua tungku untuk masak ramai-ramai di campsite.',
    attrs: { berat_kg: 1.9, bahan: 'Stainless Steel' },
    colors: [['Abu', '#6B7280']],
  },
  {
    name: 'Carrier 60L Expedition',
    category: 'carrier',
    salePrice: 1_250_000,
    discount: 5,
    rentPricePerDay: 60_000,
    rentDeposit: 250_000,
    description: 'Carrier 60 liter dengan rain cover, frame internal, nyaman untuk expedition.',
    attrs: { kapasitas_liter: 60, berat_kg: 1.9, bahan: 'Polyester 600D' },
    colors: [
      ['Hitam', '#111111'],
      ['Hijau', '#3F6212'],
    ],
  },
  {
    name: 'Carrier 40L Daypack',
    category: 'carrier',
    salePrice: 690_000,
    rentPricePerDay: 30_000,
    rentDeposit: 120_000,
    description: 'Daypack 40 liter untuk pendakian satu hari atau backpacking ringan.',
    attrs: { kapasitas_liter: 40, berat_kg: 0.9, bahan: 'Ripstop 420D' },
    colors: [['Hitam', '#111111']],
  },
  {
    name: 'Matras Foam Ultralight',
    category: 'matras',
    salePrice: 185_000,
    rentPricePerDay: 12_000,
    rentDeposit: 50_000,
    description: 'Matras gulung foam ringan, isolasi baik, ukuran compact.',
    attrs: { berat_kg: 0.5, bahan: 'EVA Foam' },
    colors: [['Abu', '#6B7280']],
  },
  {
    name: 'Headlamp 300 Lumen',
    category: 'lampu',
    salePrice: 245_000,
    description: 'Headlamp 300 lumen, tahan hujan, mode merah untuk malam.',
    attrs: { berat_kg: 0.1, bahan: 'ABS' },
    colors: [['Hitam', '#111111']],
  },
  {
    name: 'Flysheet Ultralight',
    category: 'aksesori-tenda',
    salePrice: 550_000,
    isPreorder: true,
    preorderDpPercent: 30,
    description: 'Flysheet tarup ultralight, melindungi area masak dan barang dari hujan.',
    attrs: { berat_kg: 0.7, bahan: 'Silnylon 20D' },
    colors: [['Hitam', '#111111']],
  },
]

async function seed() {
  const password = await hashPassword('password123')

  await db
    .insert(users)
    .values([
      {
        name: 'Owner Tiba Tiba',
        email: 'owner@tibatibacamping.test',
        passwordHash: password,
        role: 'owner',
        emailVerified: true,
      },
      {
        name: 'Admin Operasional',
        email: 'admin@tibatibacamping.test',
        passwordHash: password,
        role: 'admin',
        emailVerified: true,
      },
      {
        name: 'Budi Santoso',
        email: 'budi@tibatibacamping.test',
        passwordHash: password,
        role: 'customer',
        emailVerified: true,
      },
    ])
    .onConflictDoNothing()

  const demoEmails = [
    'owner@tibatibacamping.test',
    'admin@tibatibacamping.test',
    'budi@tibatibacamping.test',
  ]
  const demoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, demoEmails))
  await db
    .delete(accounts)
    .where(
      and(
        inArray(accounts.userId, demoUsers.map((u) => u.id)),
        eq(accounts.providerId, 'credential'),
      ),
    )
  await db
    .insert(accounts)
    .values(
      demoUsers.map((u) => ({
        accountId: u.id,
        providerId: 'credential',
        userId: u.id,
        password,
      })),
    )
    .onConflictDoNothing()

  const categoryRows = await db
    .insert(categories)
    .values(seedCategories)
    .onConflictDoNothing()
    .returning()
  const allCategories = categoryRows.length
    ? categoryRows
    : await db.select().from(categories)
  const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c.id]))

  const attributeRows = await db
    .insert(attributes)
    .values(seedAttributes)
    .onConflictDoNothing()
    .returning()
  const allAttributes = attributeRows.length ? attributeRows : await db.select().from(attributes)
  const attrByKey = new Map(allAttributes.map((a) => [a.key, a.id]))

  for (const p of seedProducts) {
    const slug = slugify(p.name)
    const [product] = await db
      .insert(products)
      .values({
        categoryId: categoryBySlug.get(p.category)!,
        name: p.name,
        slug,
        description: p.description,
        brandLine: 'TODO: merek resmi',
        salePrice: p.salePrice,
        discountPercent: p.discount ?? 0,
        rentPricePerDay: p.rentPricePerDay ?? null,
        rentDeposit: p.rentDeposit ?? 0,
        isSellable: true,
        isRentable: Boolean(p.rentPricePerDay),
        isPreorder: Boolean(p.isPreorder),
        preorderDpPercent: p.preorderDpPercent ?? null,
        preorderEta: p.isPreorder ? new Date(Date.now() + 45 * 86_400_000) : null,
      })
      .onConflictDoNothing()
      .returning()

    if (!product) continue

    for (const [i, [colorName, colorHex]] of (p.colors ?? [['Hitam', '#111111']]).entries()) {
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: `${slug.toUpperCase().replace(/-/g, '')}-${i + 1}`,
          colorName,
          colorHex,
          stock: p.isPreorder ? 0 : 10,
        })
        .returning()

      if (i === 0 && variant) {
        await db.insert(productImages).values({
          productId: product.id,
          variantId: variant.id,
          r2Key: IMG,
          sort: 0,
          alt: p.name,
        })
      }

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

    for (const [key, value] of Object.entries(p.attrs ?? {})) {
      const attributeId = attrByKey.get(key)
      if (!attributeId) continue
      await db
        .insert(productAttributeValues)
        .values({ productId: product.id, attributeId, value })
        .onConflictDoNothing()
    }
  }

  const counts = await db.select().from(products)
  console.log(`Seed selesai: ${counts.length} produk, akun demo: owner/admin/budi@tibatibacamping.test (password123)`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
