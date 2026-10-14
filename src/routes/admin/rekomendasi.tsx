import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import {
  adminProductsOptions,
  rebuildRecommenderNow,
  recommenderProductOptions,
  recommenderStatsOptions,
} from '#/server/fn/admin'

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
    <>
      <div className="section-header">
        <h1>Rekomendasi (CBF)</h1>
      </div>
      <div className="section-body">
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h4>Statistik</h4>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={rebuild}
              disabled={busy}
            >
              {busy ? 'Rebuild…' : 'Rebuild sekarang'}
            </button>
          </div>
          <div className="card-body">
            <div className="row text-center">
              {[
                ['Produk', stats?.products],
                ['Vektor produk', stats?.vectors],
                ['Pasangan similar', stats?.similarities],
                ['Profil pengguna', stats?.profiles],
              ].map(([label, value]) => (
                <div className="col-sm-3" key={String(label)}>
                  <div className="mb-2">
                    <div className="text-muted small">{label}</div>
                    <div className="h4 mb-0">{value ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mb-0 text-muted small">
              Rebuild otomatis berjalan (tertunda) setiap simpan produk / atribut / kamus; tombol
              di atas untuk rebuild eksplisit.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4>Debug per produk</h4>
          </div>
          <div className="card-body">
            <div className="form-group">
              <input
                className="form-control mb-2"
                placeholder="Cari produk…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="form-control"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">— pilih produk —</option>
                {products?.rows.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedId && (
              <Suspense fallback={<p className="text-muted">Memuat detail…</p>}>
                <ProductDebug id={selectedId} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function ProductDebug({ id }: { id: string }) {
  const detail = useSuspenseQuery(recommenderProductOptions(id)).data
  const maxWeight = Math.max(1, ...detail.terms.map((t) => t.weight))

  return (
    <div className="row">
      <div className="col-md-6">
        <h5>Kata berbobot teratas {detail.hasVector ? '' : '(vektor belum dibuat)'}</h5>
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Istilah</th>
              <th style={{ width: '40%' }}>Bobot</th>
            </tr>
          </thead>
          <tbody>
            {detail.terms.map((t) => (
              <tr key={t.term}>
                <td>{t.term}</td>
                <td>
                  <div
                    style={{
                      display: 'inline-block',
                      verticalAlign: 'middle',
                      width: `${(t.weight / maxWeight) * 60}%`,
                      height: 8,
                      background: '#007bff',
                      marginRight: 8,
                    }}
                  />
                  <span className="small text-muted">{t.weight.toFixed(3)}</span>
                </td>
              </tr>
            ))}
            {!detail.terms.length && (
              <tr>
                <td colSpan={2} className="text-muted">
                  Belum ada kata — cek deskripsi/kategori/atribut, lalu rebuild.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="small text-muted mb-0">Kosakata: {detail.vocabSize} term</p>
      </div>
      <div className="col-md-6">
        <h5>10 produk serupa</h5>
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Skor kosinus</th>
            </tr>
          </thead>
          <tbody>
            {detail.similar.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.score.toFixed(4)}</td>
              </tr>
            ))}
            {!detail.similar.length && (
              <tr>
                <td colSpan={2} className="text-muted">
                  Belum ada pasangan — jalankan rebuild.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
