import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import {
  katalogSearchSchema,
  splitCsv,
  toggleCsv
  
} from '#/lib/katalog-schema'
import type {KatalogSearch} from '#/lib/katalog-schema';
import { katalogFacetsOptions, katalogQueryOptions } from '#/server/fn/katalog'
import { ProductCard } from '#/components/site/ProductCard'
import { KatalogFilters } from '#/components/site/KatalogFilters'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '#/components/ui/sheet'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/(public)/katalog/')({
  validateSearch: katalogSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.fetchQuery(katalogQueryOptions(deps)),
      context.queryClient.fetchQuery(katalogFacetsOptions),
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
  relevan: 'Paling relevan',
}

function KatalogPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: facets } = useSuspenseQuery(katalogFacetsOptions)
  const { data } = useSuspenseQuery(katalogQueryOptions(search))
  const [searchText, setSearchText] = useState(search.q ?? '')
  const [openFilters, setOpenFilters] = useState(false)

  const set = (patch: Partial<KatalogSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, halaman: undefined, ...patch }),
    })

  const onToggle: React.ComponentProps<typeof KatalogFilters>['onToggle'] = (key, value) => {
    set({ [key]: toggleCsv(search[key], value) })
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const goToPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, halaman: page }) })

  const filterPanel = (
    <KatalogFilters search={search} facets={facets} onToggle={onToggle} onSet={set} />
  )

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 md:px-8">
      <div className="mb-6">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {data.total} produk ditemukan
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Katalog</h1>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            set({ q: searchText.trim() || undefined })
          }}
        >
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Cari tenda, sleeping bag, kompor…"
            aria-label="Cari produk"
            className="h-11 rounded-full pl-10 pr-4"
          />
        </form>

        <div className="flex items-center gap-2">
          <Sheet open={openFilters} onOpenChange={setOpenFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 rounded-full md:hidden">
                <SlidersHorizontal className="size-4" />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetTitle className="mb-4 text-lg font-semibold">Filter</SheetTitle>
              <div onClick={() => setOpenFilters(false)}>{filterPanel}</div>
            </SheetContent>
          </Sheet>

          <Select
            value={search.sort}
            onValueChange={(value) => set({ sort: value as KatalogSearch['sort'] })}
          >
            <SelectTrigger className="h-11 w-full rounded-full sm:w-52" aria-label="Urutkan">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ActiveChips search={search} facets={facets} onSet={set} />

      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <aside className="hidden md:block">
          <div className="sticky top-28">{filterPanel}</div>
        </aside>

        <div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {data.items.length === 0 ? (
            <div className="rounded-3xl bg-surface p-12 text-center">
              <p className="text-sm font-medium">Tidak ada produk yang cocok</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Coba longgarkan filter atau ubah kata pencarian.
              </p>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <nav aria-label="Navigasi halaman" className="mt-10 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                disabled={search.halaman <= 1}
                onClick={() => goToPage(search.halaman - 1)}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft />
              </Button>
              {Array.from({ length: totalPages })
                .slice(0, 7)
                .map((_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={page === search.halaman ? 'default' : 'outline'}
                      size="icon"
                      className="rounded-full"
                      onClick={() => goToPage(page)}
                      aria-current={page === search.halaman ? 'page' : undefined}
                    >
                      {page}
                    </Button>
                  )
                })}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                disabled={search.halaman >= totalPages}
                onClick={() => goToPage(search.halaman + 1)}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight />
              </Button>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function KatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-square rounded-3xl" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
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

  if (search.q) chips.push({ label: `Cari: “${search.q}”`, clear: { q: undefined } })

  const multi: Array<[keyof KatalogSearch, Record<string, string> | undefined]> = [
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
    chips.push({ label: `Min Rp ${search.harga_min.toLocaleString('id-ID')}`, clear: { harga_min: undefined } })
  if (search.harga_max !== undefined)
    chips.push({ label: `Maks Rp ${search.harga_max.toLocaleString('id-ID')}`, clear: { harga_max: undefined } })
  if (search.berat_max !== undefined)
    chips.push({ label: `Berat ≤ ${search.berat_max} kg`, clear: { berat_max: undefined } })
  if (search.tersedia) chips.push({ label: 'Tersedia saja', clear: { tersedia: undefined } })
  if (search.diskon) chips.push({ label: 'Diskon saja', clear: { diskon: undefined } })

  if (chips.length === 0) return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          type="button"
          onClick={() => onSet(chip.clear)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:border-foreground"
        >
          {chip.label}
          <span aria-hidden="true" className="text-muted-foreground group-hover:text-foreground">
            ×
          </span>
          <span className="sr-only">Hapus filter</span>
        </button>
      ))}
      <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => onSet({ q: undefined, kategori: undefined, tipe: undefined, musim: undefined, bahan: undefined, warna: undefined, kapasitas: undefined, harga_min: undefined, harga_max: undefined, berat_max: undefined, tersedia: undefined, diskon: undefined })}>
        Hapus semua
      </Button>
    </div>
  )
}
