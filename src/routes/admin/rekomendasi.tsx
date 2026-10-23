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
        <div className="admin-metrics">
          {[
            ['Produk', stats?.products, 'produk aktif'],
            ['Vektor produk', stats?.vectors, 'siap dicari'],
            ['Pasangan similar', stats?.similarities, 'pasangan mirip'],
            ['Profil pengguna', stats?.profiles, 'profil tersimpan'],
          ].map(([label, value, hint]) => (
            <div key={String(label)} className="admin-metrics__item">
              <div className="admin-metrics__label">{label}</div>
              <div className="admin-metrics__value">{value ?? '—'}</div>
              <div className="admin-metrics__hint">{hint}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Rebuild otomatis berjalan (tertunda) setiap simpan produk / atribut / kamus; tombol di atas
          untuk rebuild eksplisit.
        </p>
      </AdminCard>

      <AdminCard title="Debug per produk">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
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
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(t.weight / maxWeight) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                    {t.weight.toFixed(3)}
                  </span>
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
              <td className="font-medium">{s.name}</td>
              <td className="text-right font-medium tabular-nums">{s.score.toFixed(4)}</td>
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
