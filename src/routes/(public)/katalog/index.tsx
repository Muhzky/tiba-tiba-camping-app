import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { createFileRoute, Link, useLocation } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { katalogSearchSchema, splitCsv, toggleCsv } from '#/lib/katalog-schema'
import type { KatalogSearch } from '#/lib/katalog-schema'
import { rupiah } from '#/lib/format'
import { recommendationProfileOptions } from '#/server/fn/account'
import type { RecommendationProfile } from '#/server/fn/account'
import { katalogFacetsOptions, katalogQueryOptions } from '#/server/fn/katalog'
import { ProductCard } from '#/components/site/ProductCard'
import {
  EMPTY_FILTERS,
  KatalogFilters,
  activeFilterCount,
} from '#/components/site/KatalogFilters'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/(public)/katalog/')({
  validateSearch: katalogSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.fetchQuery(katalogQueryOptions(deps)),
      context.queryClient.fetchQuery(katalogFacetsOptions),
      context.queryClient.ensureQueryData(recommendationProfileOptions),
    ])
  },
  head: () => ({ meta: [{ title: 'Katalog — Tiba Tiba Camping' }] }),
  component: KatalogPage,
  pendingComponent: KatalogSkeleton,
})

const sortLabels: Record<KatalogSearch['sort'], string> = {
  terbaru: 'Terbaru',
  'harga-naik': 'Harga terendah',
  'harga-turun': 'Harga tertinggi',
  relevan: 'Paling cocok (CBF)',
}

function KatalogPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const location = useLocation()
  const { data: facets } = useSuspenseQuery(katalogFacetsOptions)
  const { data } = useSuspenseQuery(katalogQueryOptions(search))
  const { data: recommendationProfile } = useSuspenseQuery(
    recommendationProfileOptions,
  )
  const [searchText, setSearchText] = useState(search.q ?? '')
  const [openFilters, setOpenFilters] = useState(false)

  useEffect(() => {
    setSearchText(search.q ?? '')
  }, [search.q])

  const set = (patch: Partial<KatalogSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, halaman: undefined, ...patch }),
    })

  const onToggle: ComponentProps<typeof KatalogFilters>['onToggle'] = (
    key,
    value,
  ) => {
    set({ [key]: toggleCsv(search[key], value) })
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const goToPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, halaman: page }) })

  const cbfActive = search.sort === 'relevan'
  const activeCount = activeFilterCount(search)

  const filterPanel = (
    <KatalogFilters
      search={search}
      facets={facets}
      onToggle={onToggle}
      onSet={set}
    />
  )
  const drawerFilterPanel = (
    <KatalogFilters
      search={search}
      facets={facets}
      onToggle={onToggle}
      onSet={set}
      drawer
    />
  )

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 md:px-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card px-6 py-8 md:px-10 md:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-surface blur-3xl"
        />

        <div className="relative max-w-2xl">
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Katalog
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Susun atribut gear-mu — kategori, musim, bahan, kapasitas, warna,
            dan bobot — lalu pilih{' '}
            <span className="font-medium text-foreground">Paling cocok</span>{' '}
            untuk melihat produk yang paling mirip dengan kebutuhanmu.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium">
              <PackageSearch
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span aria-live="polite">{data.total} produk</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium">
              {facets.categories.length} kategori
            </span>
            <Button
              type="button"
              size="sm"
              aria-pressed={cbfActive}
              onClick={() => set({ sort: cbfActive ? 'terbaru' : 'relevan' })}
              className={`h-8 rounded-full px-3 text-xs transition-colors ${
                cbfActive
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'border border-accent/30 bg-accent/10 text-accent hover:bg-accent/15'
              }`}
            >
              {cbfActive ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Sparkles className="size-3.5" aria-hidden="true" />
              )}
              {cbfActive ? 'CBF aktif' : 'Paling cocok untukmu'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            set({ q: searchText.trim() || undefined })
          }}
        >
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Cari tenda, sleeping bag, kompor…"
            aria-label="Cari produk"
            className="h-10 rounded-full border-transparent bg-surface/60 pl-10 pr-10 text-sm focus-visible:bg-background"
          />
          {searchText ? (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              onClick={() => {
                setSearchText('')
                set({ q: undefined })
              }}
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-surface hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </form>

        <div className="flex items-center gap-2">
          <Sheet open={openFilters} onOpenChange={setOpenFilters}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="h-10 flex-1 gap-2 rounded-full border-transparent bg-surface/60 md:hidden"
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filter
                {activeCount > 0 ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[88vw] max-w-sm flex-col gap-0 p-0 data-[side=left]:w-[86vw]"
            >
              <SheetTitle className="sr-only">Filter katalog</SheetTitle>
              <div className="flex min-h-0 flex-1 flex-col">
                {drawerFilterPanel}
              </div>
              <div className="border-t border-border/70 bg-card p-3">
                <Button
                  className="h-11 w-full rounded-full"
                  onClick={() => setOpenFilters(false)}
                >
                  Tampilkan {data.total} produk
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Select
            value={search.sort}
            onValueChange={(value) =>
              set({ sort: value as KatalogSearch['sort'] })
            }
          >
            <SelectTrigger
              className="h-10 w-full gap-2 rounded-full border-transparent bg-surface/60 px-4 text-sm data-[size=default]:h-10 sm:w-56"
              aria-label="Urutkan produk"
            >
              <span className="flex items-center gap-2">
                <ArrowUpDown
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <SelectValue placeholder="Urutkan" />
              </span>
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={8}
              className="min-w-56 rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-xl backdrop-blur"
            >
              <SelectGroup className="p-0">
                <SelectLabel className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Urutkan produk
                </SelectLabel>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className="rounded-xl px-2.5 py-2.5 text-[13px]"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cbfActive ? (
        <CbfPreferencePanel
          profile={recommendationProfile}
          redirectHref={location.href}
        />
      ) : null}

      <ActiveChips search={search} facets={facets} onSet={set} />

      <div className="mt-8 grid gap-8 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden md:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            {filterPanel}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Menampilkan{' '}
              <span className="font-medium text-foreground">
                {data.items.length}
              </span>{' '}
              dari{' '}
              <span className="font-medium text-foreground">{data.total}</span>{' '}
              produk
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {data.items.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface text-muted-foreground">
                <PackageSearch className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-semibold">
                Tidak ada produk yang cocok
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Coba longgarkan filter atau ubah kata pencarian.
              </p>
              <Button
                variant="outline"
                className="mt-5 h-9 rounded-full"
                onClick={() => set({ ...EMPTY_FILTERS, q: undefined })}
              >
                Reset filter
              </Button>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <Pagination
              page={search.halaman}
              totalPages={totalPages}
              total={data.total}
              onPage={goToPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

const preferModeLabels = {
  buy: 'Belanja',
  rent: 'Sewa',
  any: 'Beli atau sewa',
} as const

function CbfPreferencePanel({
  profile,
  redirectHref,
}: {
  profile: RecommendationProfile
  redirectHref: string
}) {
  const prefs =
    profile.authenticated && profile.hasPreferences ? profile : null
  const chips: string[] = []

  if (prefs) {
    if (prefs.categories.length)
      chips.push(`Kategori: ${prefs.categories.join(', ')}`)
    if (prefs.budgetMin != null || prefs.budgetMax != null) {
      const min = prefs.budgetMin != null ? rupiah(prefs.budgetMin) : 'Tanpa minimum'
      const max = prefs.budgetMax != null ? rupiah(prefs.budgetMax) : 'Tanpa maksimum'
      chips.push(`Budget: ${min} – ${max}`)
    }
    if (prefs.partySize != null) chips.push(`${prefs.partySize} orang`)
    if (prefs.conditions.length)
      chips.push(`Cuaca/medan: ${prefs.conditions.join(', ')}`)
    if (prefs.style.length) chips.push(`Gaya: ${prefs.style.join(', ')}`)
    chips.push(`Transaksi: ${preferModeLabels[prefs.preferMode]}`)
  }

  const linkClass =
    'shrink-0 rounded-full border border-accent/30 bg-background/80 px-3 py-1 text-xs font-medium text-accent transition hover:bg-background'

  return (
    <section
      aria-live="polite"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/10 p-4"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold">
            {prefs
              ? 'Paling cocok untukmu — tersinkron dengan preferensi akun'
              : 'Diurutkan dengan Content-Based Filtering'}
          </p>
          {prefs ? (
            <Link to="/akun/preferensi" className={linkClass}>
              Ubah preferensi
            </Link>
          ) : profile.authenticated ? (
            <Link to="/akun/preferensi" className={linkClass}>
              Isi preferensi
            </Link>
          ) : (
            <Link
              to="/masuk"
              search={{ redirect: redirectHref }}
              className={linkClass}
            >
              Masuk
            </Link>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {prefs
            ? `Skor kemiripan dihitung dari preferensi akun ${prefs.name} dan riwayat interaksimu.`
            : profile.authenticated
              ? 'Preferensi akunmu belum diisi, jadi hasil masih memakai riwayat interaksi. Isi preferensi agar rekomendasi lebih tepat.'
              : 'Kamu belum masuk, jadi hasil memakai produk terlaris. Masuk agar rekomendasi mengikuti preferensi akunmu.'}
        </p>
        {chips.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip, index) => (
              <li
                key={`${chip}-${index}`}
                className="rounded-full border border-accent/20 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = pageWindow(page, totalPages)

  return (
    <nav
      aria-label="Navigasi halaman"
      className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/70 pt-6 sm:flex-row"
    >
      <p className="text-xs text-muted-foreground">
        Halaman <span className="font-medium text-foreground">{page}</span> dari{' '}
        <span className="font-medium text-foreground">{totalPages}</span> ·{' '}
        {total} produk
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-border/70"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft />
        </Button>
        {pages.map((value, index) =>
          value === 'gap' ? (
            <span
              key={`gap-${index}`}
              className="grid size-8 place-items-center text-xs text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={value}
              variant={value === page ? 'default' : 'outline'}
              size="icon"
              className={`rounded-full ${
                value === page
                  ? ''
                  : 'border-border/70 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onPage(value)}
              aria-current={value === page ? 'page' : undefined}
            >
              {value}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-border/70"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}

function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  if (current <= 4) {
    for (const page of [2, 3, 4, 5]) pages.add(page)
  }
  if (current >= total - 3) {
    for (const page of [total - 4, total - 3, total - 2, total - 1])
      pages.add(page)
  }

  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
  const result: Array<number | 'gap'> = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap')
    result.push(page)
  })
  return result
}

function KatalogSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 md:px-8">
      <Skeleton className="h-64 rounded-[2rem]" />
      <Skeleton className="mt-6 h-16 rounded-2xl" />
      <div className="mt-8 grid gap-8 md:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="hidden h-[520px] rounded-3xl md:block" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-square rounded-3xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActiveChips({
  search,
  facets,
  onSet,
}: {
  search: KatalogSearch
  facets: { categories: Array<{ name: string; slug: string }> }
  onSet: (patch: Partial<KatalogSearch>) => void
}) {
  const chips: Array<{ label: string; clear: Partial<KatalogSearch> }> = []
  const categoryName = new Map(facets.categories.map((c) => [c.slug, c.name]))

  if (search.q)
    chips.push({ label: `Cari: “${search.q}”`, clear: { q: undefined } })

  const multi: Array<
    [keyof KatalogSearch, Record<string, string> | undefined]
  > = [
    ['tipe', { beli: 'Beli', sewa: 'Sewa', preorder: 'Pre-Order' }],
    ['kategori', Object.fromEntries(categoryName)],
    ['musim', undefined],
    ['bahan', undefined],
    ['warna', undefined],
    ['kapasitas', undefined],
  ]

  for (const [key, labels] of multi) {
    for (const value of splitCsv(search[key] as string | undefined) ?? []) {
      chips.push({
        label: labels?.[value] ?? value,
        clear: { [key]: toggleCsv(search[key] as string | undefined, value) },
      })
    }
  }

  if (search.harga_min !== undefined)
    chips.push({
      label: `Min Rp ${search.harga_min.toLocaleString('id-ID')}`,
      clear: { harga_min: undefined },
    })
  if (search.harga_max !== undefined)
    chips.push({
      label: `Maks Rp ${search.harga_max.toLocaleString('id-ID')}`,
      clear: { harga_max: undefined },
    })
  if (search.berat_max !== undefined)
    chips.push({
      label: `Berat ≤ ${search.berat_max} kg`,
      clear: { berat_max: undefined },
    })
  if (search.tersedia)
    chips.push({ label: 'Tersedia saja', clear: { tersedia: undefined } })
  if (search.diskon)
    chips.push({ label: 'Diskon saja', clear: { diskon: undefined } })

  if (chips.length === 0) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Filter aktif
      </span>
      {chips.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          type="button"
          onClick={() => onSet(chip.clear)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium transition hover:border-foreground/25 hover:bg-surface"
        >
          {chip.label}
          <X
            className="size-3 text-muted-foreground transition group-hover:text-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Hapus filter</span>
        </button>
      ))}
      <button
        type="button"
        className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground"
        onClick={() => onSet({ ...EMPTY_FILTERS, q: undefined })}
      >
        Hapus semua
      </button>
    </div>
  )
}
