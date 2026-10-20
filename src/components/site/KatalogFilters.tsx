import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { splitCsv, toggleCsv } from '#/lib/katalog-schema'
import type { KatalogSearch, TransactionMode } from '#/lib/katalog-schema'
import type { KatalogFacets } from '#/server/fn/katalog'

type Props = {
  search: KatalogSearch
  facets: KatalogFacets
  drawer?: boolean
  onToggle: (
    key: 'kategori' | 'tipe' | 'musim' | 'bahan' | 'warna' | 'kapasitas',
    value: string,
  ) => void
  onSet: (patch: Partial<KatalogSearch>) => void
}

const modeLabels: Record<TransactionMode, string> = {
  beli: 'Beli',
  sewa: 'Sewa',
  preorder: 'Pre-Order',
}

export const EMPTY_FILTERS: Partial<KatalogSearch> = {
  kategori: undefined,
  tipe: undefined,
  musim: undefined,
  bahan: undefined,
  warna: undefined,
  kapasitas: undefined,
  harga_min: undefined,
  harga_max: undefined,
  berat_max: undefined,
  tersedia: undefined,
  diskon: undefined,
}

export function activeFilterCount(search: KatalogSearch): number {
  const multi = [
    'kategori',
    'tipe',
    'musim',
    'bahan',
    'warna',
    'kapasitas',
  ] as const
  return (
    multi.reduce(
      (total, key) => total + (splitCsv(search[key])?.length ?? 0),
      0,
    ) +
    (search.harga_min !== undefined ? 1 : 0) +
    (search.harga_max !== undefined ? 1 : 0) +
    (search.berat_max !== undefined ? 1 : 0) +
    (search.tersedia ? 1 : 0) +
    (search.diskon ? 1 : 0)
  )
}

export const hasActiveFilters = (search: KatalogSearch) =>
  activeFilterCount(search) > 0

export function KatalogFilters({
  search,
  facets,
  drawer = false,
  onToggle,
  onSet,
}: Props) {
  const activeCount = activeFilterCount(search)

  return (
    <div className="flex min-h-0 flex-col">
      <div
        className={`flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3.5 ${
          drawer ? 'pr-12' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-surface text-foreground/70">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-semibold">Filter</h2>
          {activeCount > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </div>
        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-full px-2 text-xs text-sale hover:bg-sale/10 hover:text-sale"
            onClick={() => onSet(EMPTY_FILTERS)}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-width:thin]">
        <FilterGroup title="Tipe transaksi">
          {(Object.keys(modeLabels) as TransactionMode[]).map((mode) => (
            <CheckRow
              key={mode}
              id={`tipe-${mode}`}
              label={modeLabels[mode]}
              checked={splitCsv(search.tipe)?.includes(mode) ?? false}
              onCheckedChange={() => onToggle('tipe', mode)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Kategori">
          {facets.categories.map((category) => (
            <CheckRow
              key={category.slug}
              id={`kategori-${category.slug}`}
              label={category.name}
              checked={
                splitCsv(search.kategori)?.includes(category.slug) ?? false
              }
              onCheckedChange={() => onToggle('kategori', category.slug)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Harga (Rp)">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Min"
                aria-label="Harga minimum"
                value={search.harga_min ?? ''}
                onChange={(event) =>
                  onSet({
                    harga_min: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                className="h-9 rounded-xl border-transparent bg-surface/70 pl-8 text-sm focus-visible:bg-background"
              />
            </div>
            <span className="text-xs text-muted-foreground">–</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Maks"
                aria-label="Harga maksimum"
                value={search.harga_max ?? ''}
                onChange={(event) =>
                  onSet({
                    harga_max: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                className="h-9 rounded-xl border-transparent bg-surface/70 pl-8 text-sm focus-visible:bg-background"
              />
            </div>
          </div>
        </FilterGroup>

        {facets.kapasitas.length ? (
          <FilterGroup title="Kapasitas orang">
            <div className="flex flex-wrap gap-1.5">
              {facets.kapasitas.map((capacity) => {
                const selected =
                  splitCsv(search.kapasitas)?.includes(String(capacity)) ??
                  false
                return (
                  <button
                    key={capacity}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggle('kapasitas', String(capacity))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground/80 hover:border-foreground/25 hover:bg-surface'
                    }`}
                  >
                    {capacity} orang
                  </button>
                )
              })}
            </div>
          </FilterGroup>
        ) : null}

        {facets.musim.length ? (
          <FilterGroup title="Musim / cuaca">
            {facets.musim.map((season) => (
              <CheckRow
                key={season}
                id={`musim-${season}`}
                label={season}
                checked={splitCsv(search.musim)?.includes(season) ?? false}
                onCheckedChange={() => onToggle('musim', season)}
              />
            ))}
          </FilterGroup>
        ) : null}

        {facets.bahan.length ? (
          <FilterGroup title="Bahan">
            {facets.bahan.map((material) => (
              <CheckRow
                key={material}
                id={`bahan-${material}`}
                label={material}
                checked={splitCsv(search.bahan)?.includes(material) ?? false}
                onCheckedChange={() => onToggle('bahan', material)}
              />
            ))}
          </FilterGroup>
        ) : null}

        {facets.warna.length ? (
          <FilterGroup title="Warna">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {facets.warna.map((color) => {
                const hex = colorToHex(color)
                const selected =
                  splitCsv(search.warna)?.includes(color) ?? false
                return (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Warna ${color}`}
                    aria-pressed={selected}
                    onClick={() => onToggle('warna', color)}
                    className={`grid size-8 place-items-center rounded-full border border-black/10 transition hover:scale-105 active:scale-95 ${
                      selected
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card'
                        : ''
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {selected ? (
                      <Check
                        className={`size-3.5 ${isLight(hex) ? 'text-foreground' : 'text-white'}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </FilterGroup>
        ) : null}

        <FilterGroup title="Berat maksimal">
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              placeholder="Contoh: 2"
              aria-label="Berat maksimal dalam kilogram"
              value={search.berat_max ?? ''}
              onChange={(event) =>
                onSet({
                  berat_max: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              className="h-9 rounded-xl border-transparent bg-surface/70 pr-8 text-sm focus-visible:bg-background"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
              kg
            </span>
          </div>
        </FilterGroup>

        <FilterGroup title="Lainnya" className="last:border-b-0">
          <CheckRow
            id="tersedia"
            label="Tersedia saja (stok > 0)"
            checked={Boolean(search.tersedia)}
            onCheckedChange={() =>
              onSet({ tersedia: search.tersedia ? undefined : 1 })
            }
          />
          <CheckRow
            id="diskon"
            label="Diskon saja"
            checked={Boolean(search.diskon)}
            onCheckedChange={() =>
              onSet({ diskon: search.diskon ? undefined : 1 })
            }
          />
        </FilterGroup>
      </div>
    </div>
  )
}

function FilterGroup({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <details
      open
      className={`group border-b border-border/60 py-2 last:border-b-0 ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors outline-none marker:content-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-1 space-y-0.5 px-1 pb-2">{children}</div>
    </details>
  )
}

function CheckRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-surface hover:text-foreground"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <span className="leading-snug">{label}</span>
    </label>
  )
}

const namedColors: Record<string, string> = {
  hitam: '#111111',
  putih: '#FFFFFF',
  abu: '#6B7280',
  'abu-abu': '#6B7280',
  biru: '#457AA0',
  hijau: '#3F6212',
  merah: '#E11D1D',
  oranye: '#EA580C',
  kuning: '#EAB308',
}

function colorToHex(name: string): string {
  const key = name.toLowerCase().trim()
  if (key.startsWith('#')) return key
  return namedColors[key] ?? '#D1D5DB'
}

function isLight(hex: string): boolean {
  const value =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

export { toggleCsv }
