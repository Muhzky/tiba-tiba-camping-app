import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Backpack,
  BedDouble,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  LayoutGrid,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Tent,
  TriangleAlert,
  Truck,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { z } from 'zod'
import { cn } from 'cn'
import { Button } from '#/components/ui/button'
import { Reveal } from '#/components/site/Reveal'
import { rentalCatalogOptions } from '#/server/fn/rental'
import type { RentalCatalogItem } from '#/server/fn/rental'
import { rupiah } from '#/lib/format'

const sewaSearchSchema = z.object({
  kategori: z.string().optional(),
})

export const Route = createFileRoute('/(public)/sewa')({
  validateSearch: sewaSearchSchema,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(rentalCatalogOptions)
  },
  head: () => ({
    meta: [
      { title: 'Sewa Peralatan Outdoor — Tiba Tiba Camping' },
      {
        name: 'description',
        content:
          'Sewa tenda, carrier, sleeping bag, matras, dan perlengkapan camping lain dengan harga harian transparan. Unit terawat, deposit jelas, ambil di toko atau kirim ke alamat.',
      },
    ],
  }),
  component: SewaPage,
})

const CORE_CATEGORY_SLUGS = ['tenda', 'carrier', 'sleeping-bag', 'matras']

const CATEGORY_CARDS: Array<{
  slug: string
  title: string
  desc: string
  icon: LucideIcon
}> = [
  {
    slug: 'tenda',
    title: 'Tenda',
    desc: 'Dome, tunnel, ultralight',
    icon: Tent,
  },
  {
    slug: 'carrier',
    title: 'Carrier',
    desc: 'Daypack hingga ekspedisi',
    icon: Backpack,
  },
  {
    slug: 'sleeping-bag',
    title: 'Sleeping Bag',
    desc: 'Hangat sampai -5°C',
    icon: BedDouble,
  },
  {
    slug: 'matras',
    title: 'Matras',
    desc: 'Foam & ultralight',
    icon: LayoutGrid,
  },
  {
    slug: 'lainnya',
    title: 'Perlengkapan Lainnya',
    desc: 'Kompor, lampu, aksesori',
    icon: Package,
  },
]

const STEPS: Array<{ title: string; desc: string; icon: LucideIcon }> = [
  {
    title: 'Pilih produk',
    desc: 'Buka katalog sewa, cek kapasitas, harga per hari, dan sisa unit yang tersedia.',
    icon: Search,
  },
  {
    title: 'Tentukan tanggal',
    desc: 'Pilih tanggal mulai dan selesai. Sistem menghitung durasi serta total sewa otomatis.',
    icon: CalendarDays,
  },
  {
    title: 'Bayar',
    desc: 'Bayar biaya sewa plus deposit 50% dari total sewa. Deposit dikembalikan setelah unit kembali dan diperiksa.',
    icon: CreditCard,
  },
  {
    title: 'Ambil atau terima',
    desc: 'Ambil di toko atau kirim ke alamat. Cek kelengkapan unit saat serah terima.',
    icon: PackageCheck,
  },
]

const TERMS: Array<{ title: string; desc: string; icon: LucideIcon }> = [
  {
    title: 'Deposit',
    desc: 'Deposit ditagihkan bersama biaya sewa. Besarnya tergantung unit, mulai dari Rp 50.000, dan dikembalikan setelah alat diperiksa.',
    icon: Wallet,
  },
  {
    title: 'Pengembalian',
    desc: 'Kembalikan alat pada tanggal selesai sebelum toko tutup pukul 18.00 WIB, dalam kondisi bersih dan lengkap dengan aksesorinya.',
    icon: Clock,
  },
  {
    title: 'Keterlambatan',
    desc: 'Keterlambatan dihitung per hari dan dikenakan biaya sesuai harga sewa harian unit. Biaya ini dipotong dari deposit.',
    icon: TriangleAlert,
  },
  {
    title: 'Kerusakan & kehilangan',
    desc: 'Kerusakan atau kehilangan dinilai saat pemeriksaan. Biaya perbaikan atau penggantian dipotong dari deposit, sisanya dikembalikan.',
    icon: ShieldCheck,
  },
]

const FAQS = [
  {
    q: 'Apakah harus punya akun untuk menyewa?',
    a: 'Ya. Masuk atau daftar dulu agar periode sewa, status pesanan, dan pengembalian deposit tercatat dengan aman di akunmu.',
  },
  {
    q: 'Berapa lama minimal masa sewa?',
    a: 'Minimal satu hari. Durasi dihitung dari tanggal mulai sampai tanggal selesai dan dibulatkan ke atas per hari.',
  },
  {
    q: 'Apakah deposit dikembalikan?',
    a: 'Deposit sebesar 50% dari total sewa dikembalikan setelah unit diterima kembali dan diperiksa. Denda keterlambatan atau kerusakan, jika ada, dipotong dari deposit.',
  },
  {
    q: 'Bisa ambil di toko atau harus dikirim?',
    a: 'Bisa keduanya. Pilih metode penerimaan saat checkout: ambil di toko tanpa ongkir, atau kirim ke alamat dengan ongkir per zona.',
  },
  {
    q: 'Bagaimana kalau alat rusak saat dipakai?',
    a: 'Laporkan segera ke tim kami. Kerusakan akan dinilai saat pengembalian, lalu biaya perbaikan atau penggantian dipotong dari deposit.',
  },
  {
    q: 'Bisakah memperpanjang masa sewa?',
    a: 'Perpanjangan bisa diajukan selama unit masih tersedia pada periode berikutnya. Hubungi kami sebelum tanggal pengembalian.',
  },
  {
    q: 'Apakah alat dibersihkan sebelum diserahkan?',
    a: 'Ya. Setiap unit dibersihkan dan diperiksa kondisinya sebelum diserahkan, termasuk kelengkapan aksesori dan fungsi utamanya.',
  },
]

function SewaPage() {
  const { data } = useSuspenseQuery(rentalCatalogOptions)
  const search = Route.useSearch()
  const activeCategory = search.kategori

  const categoryBySlug = useMemo(
    () => new Map(data.categories.map((category) => [category.slug, category])),
    [data.categories],
  )

  const otherCategories = data.categories.filter(
    (category) => !CORE_CATEGORY_SLUGS.includes(category.slug),
  )
  const otherCount = otherCategories.reduce(
    (sum, category) => sum + category.count,
    0,
  )

  const filteredItems = useMemo(() => {
    if (!activeCategory) return data.items
    if (activeCategory === 'lainnya') {
      return data.items.filter(
        (item) => !CORE_CATEGORY_SLUGS.includes(item.categorySlug),
      )
    }
    return data.items.filter((item) => item.categorySlug === activeCategory)
  }, [activeCategory, data.items])

  const activeCategoryName =
    activeCategory === 'lainnya'
      ? 'Perlengkapan lainnya'
      : activeCategory
        ? categoryBySlug.get(activeCategory)?.name
        : null

  const chipCategories = [
    ...CORE_CATEGORY_SLUGS.flatMap((slug) => {
      const category = categoryBySlug.get(slug)
      return category
        ? [{ slug, name: category.name, count: category.count }]
        : []
    }),
    ...(otherCount > 0
      ? [{ slug: 'lainnya', name: 'Lainnya', count: otherCount }]
      : []),
  ]

  return (
    <div className="pb-24 pt-24 md:pt-28">
      {/* 1. Hero */}
      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-10 border-b border-border pb-10 md:pb-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16">
          <div>
            <h1 className="mt-5 text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
              Sewa Peralatan Outdoor,{' '}
              <span className="text-muted-foreground">
                Siap untuk Petualanganmu.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Tidak perlu membeli semua gear untuk satu trip. Pilih alat yang
              kamu butuhkan, tentukan tanggal, dan berangkat dengan unit yang
              sudah diperiksa dan dibersihkan.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-10 rounded-full px-6 text-sm font-semibold"
                asChild
              >
                <a href="#katalog-sewa">
                  Lihat katalog sewa
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </Button>
              <a
                href="#cara-menyewa"
                className="inline-flex h-10 items-center justify-center rounded-full border border-foreground/20 px-6 text-sm font-medium transition hover:bg-foreground hover:text-background"
              >
                Cara menyewa
              </a>
            </div>
          </div>

          <aside className="lg:pb-1">
            <div className="border-t border-foreground/80 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Harga sewa
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">
                  {rupiah(data.minRentPerDay)}
                </span>
                <span className="text-xs text-muted-foreground">/ hari</span>
              </p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Deposit terpisah dan dikembalikan setelah unit kembali serta
                diperiksa.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 divide-x divide-border border-y border-border">
              <div className="py-3 pr-4">
                <p className="text-xl font-semibold">{data.total}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Jenis alat
                </p>
              </div>
              <div className="py-3 pl-4">
                <p className="text-xl font-semibold">{data.totalStock}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Unit terawat
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <Check className="size-3 text-accent" aria-hidden="true" />
                Deposit kembali
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Check className="size-3 text-accent" aria-hidden="true" />
                Ambil di toko
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Check className="size-3 text-accent" aria-hidden="true" />
                Kirim ke alamat
              </li>
            </ul>
          </aside>
        </div>
      </section>

      {/* 2. Kategori alat outdoor */}
      <section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
        <Reveal>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Kategori alat outdoor
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Pilih alat sesuai petualanganmu
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Dari tenda untuk tidur nyenyak sampai carrier untuk membawa semua
              kebutuhan — mulai dari kategori yang paling sering disewa.
            </p>
          </div>
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORY_CARDS.map((category) => {
            const count =
              category.slug === 'lainnya'
                ? otherCount
                : (categoryBySlug.get(category.slug)?.count ?? 0)
            const isActive = activeCategory === category.slug
            const Icon = category.icon

            return (
              <Reveal key={category.slug} className="h-full">
                <Link
                  to="/sewa"
                  search={{ kategori: category.slug }}
                  hash="katalog-sewa"
                  className={cn(
                    'group flex h-full flex-col rounded-3xl border p-5 transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/70 bg-surface hover:border-foreground/20',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-11 place-items-center rounded-2xl transition-colors',
                      isActive
                        ? 'bg-primary-foreground/15 text-primary-foreground'
                        : 'bg-background text-foreground',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="mt-5 text-base font-semibold">
                    {category.title}
                  </span>
                  <span
                    className={cn(
                      'mt-1 text-xs leading-relaxed',
                      isActive
                        ? 'text-primary-foreground/65'
                        : 'text-muted-foreground',
                    )}
                  >
                    {category.desc}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-5 text-xs font-medium">
                    <span
                      className={
                        isActive
                          ? 'text-primary-foreground/75'
                          : 'text-muted-foreground'
                      }
                    >
                      {count} jenis
                    </span>
                    <ArrowRight
                      className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* 3. Katalog sewa */}
      <section
        id="katalog-sewa"
        className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-16 md:px-8 md:pt-24"
      >
        <Reveal>
          <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Katalog sewa
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Gear siap dibawa pulang
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Harga transparan per hari. Deposit dikembalikan setelah unit
                kembali dan diperiksa.
              </p>
            </div>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-xs font-medium">
              <Package
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span aria-live="polite">
                {filteredItems.length} dari {data.total} alat
                {activeCategoryName ? ` · ${activeCategoryName}` : ''}
              </span>
            </p>
          </div>
        </Reveal>

        <div
          role="group"
          aria-label="Filter kategori sewa"
          className="mt-6 flex flex-wrap gap-2"
        >
          <FilterLink current={!activeCategory} to="/sewa">
            Semua
            <span className="ml-1.5 text-[11px] opacity-70">{data.total}</span>
          </FilterLink>
          {chipCategories.map((category) => (
            <FilterLink
              key={category.slug}
              current={activeCategory === category.slug}
              to="/sewa"
              search={{ kategori: category.slug }}
            >
              {category.name}
              <span className="ml-1.5 text-[11px] opacity-70">
                {category.count}
              </span>
            </FilterLink>
          ))}
        </div>

        {filteredItems.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map((item) => (
              <Reveal key={item.id} className="h-full">
                <RentalCard item={item} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
            <Package
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-lg font-semibold">
              Belum ada alat di kategori ini
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Coba lihat semua alat sewa yang tersedia, atau pilih kategori lain
              di atas.
            </p>
            <Button className="mt-6 h-10 rounded-full px-6" asChild>
              <Link to="/sewa" hash="katalog-sewa">
                Lihat semua alat
              </Link>
            </Button>
          </div>
        )}
      </section>

      {/* 4. Cara menyewa */}
      <section
        id="cara-menyewa"
        className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-20 md:px-8 md:pt-28"
      >
        <Reveal>
          <div className="overflow-hidden rounded-[2rem] bg-foreground px-6 py-10 text-background md:rounded-[2.5rem] md:px-10 md:py-14">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Cara menyewa
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Empat langkah, gear siap dipakai.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-background/65 md:text-base">
                Prosesnya sama seperti belanja biasa — bedanya kamu menentukan
                tanggal sewa dan membayar deposit yang akan kembali.
              </p>
            </div>

            <ol className="mt-10 grid gap-6 md:grid-cols-4 md:gap-5">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                return (
                  <li key={step.title} className="relative">
                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-12 right-0 top-5 hidden h-px bg-background/15 md:block"
                      />
                    ) : null}
                    <div className="relative flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-sm font-bold text-foreground">
                        {index + 1}
                      </span>
                      <Icon
                        className="size-5 text-background/40"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-background/65">
                      {step.desc}
                    </p>
                  </li>
                )
              })}
            </ol>

            <div className="mt-9 flex flex-col gap-3 rounded-2xl border border-background/15 bg-background/5 p-4 text-sm text-background/70 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2">
                <Store
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                Ambil di toko tanpa ongkir, atau kirim ke alamat dengan ongkir
                per zona.
              </p>
              <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-background/55">
                <Truck className="size-4" aria-hidden="true" />
                Seluruh Indonesia
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 5. Ketentuan sewa */}
      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8 md:pt-28">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Ketentuan sewa
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Jelas dari awal, tenang sampai kembali.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              Kami menulis ketentuan utama di sini supaya tidak ada kejutan saat
              pembayaran maupun pengembalian. Kalau ada yang belum jelas,
              tanyakan sebelum memesan.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface px-4 py-2 text-xs font-medium">
              <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
              Unit diperiksa sebelum dan sesudah sewa
            </div>

            <ul className="mt-7 space-y-2.5 text-sm text-muted-foreground">
              {[
                'Harga sewa dihitung per hari, bukan per 24 jam.',
                'Deposit terpisah dari biaya sewa dan dikembalikan.',
                'Perpanjangan tergantung ketersediaan unit.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {TERMS.map((term) => {
              const Icon = term.icon
              return (
                <Reveal key={term.title} className="h-full">
                  <div className="flex h-full flex-col rounded-3xl bg-surface p-6">
                    <span className="grid size-11 place-items-center rounded-2xl bg-background">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-base font-semibold">
                      {term.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {term.desc}
                    </p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8 md:pt-28">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              FAQ
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Pertanyaan umum tentang penyewaan.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground md:text-base">
              Belum ketemu jawabannya? Hubungi tim kami lewat WhatsApp atau
              email — kami bantu pilih alat dan tanggal yang pas.
            </p>
            <Button variant="outline" className="mt-6 rounded-full" asChild>
              <a href="#kontak">
                Hubungi kami
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          </Reveal>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8 md:pt-28">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-[2rem] border border-border/70 bg-surface/60 p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Siap berangkat?
              </p>
              <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                Pilih alatnya, tentukan tanggalnya, kami siapkan unitnya.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Butuh bantuan memilih tenda atau sleeping bag? Tim kami bisa
                bantu menyesuaikan dengan lokasi dan cuaca trip-mu.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button
                className="h-11 rounded-full px-7 text-base font-semibold"
                asChild
              >
                <a href="#katalog-sewa">Lihat katalog sewa</a>
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full px-7 text-base font-medium"
                asChild
              >
                <a href="#kontak">Tanya tim</a>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

function FilterLink({
  current,
  to,
  search,
  children,
}: {
  current: boolean
  to: '/sewa'
  search?: { kategori: string }
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      search={search ?? {}}
      hash="katalog-sewa"
      activeOptions={{ includeSearch: true, exact: true }}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        current
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border/70 bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function RentalCard({ item }: { item: RentalCatalogItem }) {
  const inStock = item.stock > 0

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl bg-surface transition-transform duration-300 hover:-translate-y-1">
      <Link
        to="/produk/$slug"
        params={{ slug: item.slug }}
        className="relative block aspect-[4/3] overflow-hidden bg-white/60"
      >
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur">
          <span
            className={cn(
              'size-1.5 rounded-full',
              inStock ? 'bg-emerald-500' : 'bg-sale',
            )}
            aria-hidden="true"
          />
          {inStock ? `Stok ${item.stock} unit` : 'Stok habis'}
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-foreground/85 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-background backdrop-blur">
          {item.categoryName}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        <h3 className="text-base font-semibold leading-snug">
          <Link
            to="/produk/$slug"
            params={{ slug: item.slug }}
            className="transition-colors hover:text-accent"
          >
            {item.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            <p className="text-sm font-medium text-sale whitespace-nowrap">
              {item.rentPerDayLabel}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                / hari
              </span>
            </p>
            <p className="text-[9px] text-muted-foreground">
              Deposit 50% dari total sewa
            </p>
          </div>

          {item.colors.length > 0 ? (
            <div
              className="flex items-center gap-1 pb-1"
              aria-label="Pilihan warna"
            >
              {item.colors.slice(0, 3).map((color) => (
                <span
                  key={color.hex}
                  className="size-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          ) : null}
        </div>

        <Button
          variant="outline"
          className="mt-4 h-9 w-full rounded-full text-sm font-medium"
          asChild
        >
          <Link to="/produk/$slug" params={{ slug: item.slug }}>
            Lihat detail
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl border border-border/70 bg-card px-5 py-4 transition-colors open:bg-surface/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden md:text-base">
        {question}
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground transition duration-300 group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground">
          <Plus className="size-4" aria-hidden="true" />
        </span>
      </summary>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {answer}
      </p>
    </details>
  )
}
