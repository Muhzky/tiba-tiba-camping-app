import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import {
  adminProductsOptions,
  rebuildRecommenderNow,
  recommenderProductOptions,
  recommenderStatsOptions,
} from '#/server/fn/admin'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { SearchInput, SelectInput } from '#/components/admin/field'
import { buttonClass } from '#/components/admin/button'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/admin/rekomendasi')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(recommenderStatsOptions)
    await context.queryClient.ensureQueryData(adminProductsOptions({ page: 1 }))
  },
  component: RekomendasiPage,
})

function RekomendasiPage() {
  const queryClient = useQueryClient()
  const stats = useQuery(recommenderStatsOptions).data
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const products = useQuery(adminProductsOptions({ q: q || undefined, page: 1 })).data

  const rebuildFn = useServerFn(rebuildRecommenderNow)
  const [busy, setBusy] = useState(false)

  const rebuild = async () => {
    setBusy(true)
    try {
      const result = await rebuildFn()
      await queryClient.invalidateQueries({ queryKey: ['admin', 'recommender'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'recommender-product'] })
      toast.success(
        `Rebuild selesai: ${result.products} vektor, ${result.pairs} pasangan similar, kosakata ${result.vocabSize}.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rebuild gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminPage
      title="Rekomendasi (CBF)"
      description="Content-based filtering: vektor produk, kosakata, dan pasangan serupa."
    >
      <AdminCard
        title="Statistik"
        actions={
          <button
            type="button"
            className={buttonClass({ variant: 'primary', size: 'sm' })}
            onClick={rebuild}
            disabled={busy}
          >
            <RefreshCw className={cn(busy && 'animate-spin')} aria-hidden="true" />
            {busy ? 'Rebuild…' : 'Rebuild sekarang'}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {[
            ['Produk', stats?.products],
            ['Vektor produk', stats?.vectors],
            ['Pasangan similar', stats?.similarities],
            ['Profil pengguna', stats?.profiles],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-semibold">{value ?? '—'}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Rebuild otomatis berjalan (tertunda) setiap simpan produk / atribut / kamus; tombol di atas
          untuk rebuild eksplisit.
        </p>
      </AdminCard>

      <AdminCard title="Debug per produk">
        <div className="grid gap-2">
          <SearchInput label="produk" placeholder="Cari produk…" value={q} onChange={setQ} />
          <SelectInput
            ariaLabel="Pilih produk"
            value={selectedId}
            onChange={setSelectedId}
            options={[
              { value: '', label: '— pilih produk —' },
              ...(products?.rows.map((p) => ({ value: p.id, label: p.name })) ?? []),
            ]}
          />
        </div>

        {selectedId ? (
          <Suspense fallback={<p className="text-muted-foreground">Memuat detail…</p>}>
            <ProductDebug id={selectedId} />
          </Suspense>
        ) : null}
      </AdminCard>
    </AdminPage>
  )
}

function ProductDebug({ id }: { id: string }) {
  const detail = useSuspenseQuery(recommenderProductOptions(id)).data
  const maxWeight = Math.max(1, ...detail.terms.map((t) => t.weight))

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Kata berbobot teratas {detail.hasVector ? '' : '(vektor belum dibuat)'}
        </h3>
        <AdminTable
          head={
            <>
              <th scope="col">Istilah</th>
              <th scope="col" className="w-2/5">
                Bobot
              </th>
            </>
          }
        >
          {detail.terms.map((t) => (
            <tr key={t.term}>
              <td>{t.term}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{ width: `${(t.weight / maxWeight) * 60}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{t.weight.toFixed(3)}</span>
                </div>
              </td>
            </tr>
          ))}
          {!detail.terms.length ? (
            <tr>
              <td colSpan={2} className="text-muted-foreground">
                Belum ada kata — cek deskripsi/kategori/atribut, lalu rebuild.
              </td>
            </tr>
          ) : null}
        </AdminTable>
        <p className="mt-2 text-xs text-muted-foreground">Kosakata: {detail.vocabSize} term</p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">10 produk serupa</h3>
        <AdminTable
          head={
            <>
              <th scope="col">Produk</th>
              <th scope="col" className="text-right">
                Skor kosinus
              </th>
            </>
          }
        >
          {detail.similar.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="text-right font-medium">{s.score.toFixed(4)}</td>
            </tr>
          ))}
          {!detail.similar.length ? (
            <tr>
              <td colSpan={2} className="text-muted-foreground">
                Belum ada pasangan — jalankan rebuild.
              </td>
            </tr>
          ) : null}
        </AdminTable>
      </div>
    </div>
  )
}
