import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import {
  splitCsv,
  toggleCsv
  
  
} from '#/lib/katalog-schema'
import type {KatalogSearch, TransactionMode} from '#/lib/katalog-schema';
import type { KatalogFacets } from '#/server/fn/katalog'

type Props = {
  search: KatalogSearch
  facets: KatalogFacets
  onToggle: (key: 'kategori' | 'tipe' | 'musim' | 'bahan' | 'warna' | 'kapasitas', value: string) => void
  onSet: (patch: Partial<KatalogSearch>) => void
}

const modeLabels: Record<TransactionMode, string> = {
  beli: 'Beli',
  sewa: 'Sewa',
  preorder: 'Pre-Order',
}

export function KatalogFilters({ search, facets, onToggle, onSet }: Props) {
  const hasFilter = Boolean(
    search.kategori || search.tipe || search.musim || search.bahan || search.warna ||
      search.kapasitas || search.berat_max !== undefined || search.tersedia || search.diskon,
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Filter</h2>
        {hasFilter ? (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-sale"
            onClick={() =>
              onSet({
                kategori: undefined,
                tipe: undefined,
                musim: undefined,
                bahan: undefined,
                warna: undefined,
                kapasitas: undefined,
                berat_max: undefined,
                tersedia: undefined,
                diskon: undefined,
              })
            }
          >
            Reset
          </Button>
        ) : null}
      </div>

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

      <Separator />

      <FilterGroup title="Kategori">
        {facets.categories.map((category) => (
          <CheckRow
            key={category.slug}
            id={`kategori-${category.slug}`}
            label={category.name}
            checked={splitCsv(search.kategori)?.includes(category.slug) ?? false}
            onCheckedChange={() => onToggle('kategori', category.slug)}
          />
        ))}
      </FilterGroup>

      <Separator />

      <FilterGroup title="Harga (Rp)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            aria-label="Harga minimum"
            value={search.harga_min ?? ''}
            onChange={(event) =>
              onSet({ harga_min: event.target.value ? Number(event.target.value) : undefined })
            }
            className="rounded-full"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Maks"
            aria-label="Harga maksimum"
            value={search.harga_max ?? ''}
            onChange={(event) =>
              onSet({ harga_max: event.target.value ? Number(event.target.value) : undefined })
            }
            className="rounded-full"
          />
        </div>
      </FilterGroup>

      <Separator />

      {facets.kapasitas.length ? (
        <>
          <FilterGroup title="Kapasitas orang">
            <div className="flex flex-wrap gap-2">
              {facets.kapasitas.map((capacity) => (
                <button
                  key={capacity}
                  type="button"
                  aria-pressed={splitCsv(search.kapasitas)?.includes(String(capacity)) ?? false}
                  onClick={() => onToggle('kapasitas', String(capacity))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    splitCsv(search.kapasitas)?.includes(String(capacity))
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-foreground'
                  }`}
                >
                  {capacity} orang
                </button>
              ))}
            </div>
          </FilterGroup>
          <Separator />
        </>
      ) : null}

      {facets.musim.length ? (
        <>
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
          <Separator />
        </>
      ) : null}

      {facets.bahan.length ? (
        <>
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
          <Separator />
        </>
      ) : null}

      {facets.warna.length ? (
        <>
          <FilterGroup title="Warna">
            <div className="flex flex-wrap gap-2">
              {facets.warna.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`Warna ${color}`}
                  aria-pressed={splitCsv(search.warna)?.includes(color) ?? false}
                  onClick={() => onToggle('warna', color)}
                  className={`size-7 rounded-full border-2 transition ${
                    splitCsv(search.warna)?.includes(color)
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border hover:border-foreground'
                  }`}
                  style={{ backgroundColor: colorToHex(color) }}
                />
              ))}
            </div>
          </FilterGroup>
          <Separator />
        </>
      ) : null}

      <FilterGroup title="Berat maksimal (kg)">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          placeholder="Contoh: 2"
          aria-label="Berat maksimal"
          value={search.berat_max ?? ''}
          onChange={(event) =>
            onSet({ berat_max: event.target.value ? Number(event.target.value) : undefined })
          }
          className="rounded-full"
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Lainnya">
        <CheckRow
          id="tersedia"
          label="Tersedia saja (stok > 0)"
          checked={Boolean(search.tersedia)}
          onCheckedChange={() => onSet({ tersedia: search.tersedia ? undefined : 1 })}
        />
        <CheckRow
          id="diskon"
          label="Diskon saja"
          checked={Boolean(search.diskon)}
          onCheckedChange={() => onSet({ diskon: search.diskon ? undefined : 1 })}
        />
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
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
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-foreground/90">
        {label}
      </Label>
    </div>
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

export { toggleCsv }
