import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  attributesOptions,
  deleteAttribute,
  deleteTerm,
  dictionaryOptions,
  saveAttribute,
  saveTerm,
} from '#/server/fn/admin'

export const Route = createFileRoute('/admin/atribut')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(attributesOptions)
    await context.queryClient.ensureQueryData(dictionaryOptions({ page: 1 }))
  },
  component: AtributPage,
})

const KIND_LABEL: Record<string, string> = {
  synonym: 'Sinonim',
  tag: 'Tag',
  stopword: 'Stopword',
}

type AttrForm = {
  id?: string
  name: string
  key: string
  type: 'text' | 'enum' | 'number' | 'boolean'
  allowedCsv: string
  weight: string
  isFilterable: boolean
  showInSpec: boolean
}

const EMPTY_ATTR: AttrForm = {
  name: '',
  key: '',
  type: 'text',
  allowedCsv: '',
  weight: '1',
  isFilterable: true,
  showInSpec: true,
}

function AtributPage() {
  const queryClient = useQueryClient()
  const attributes = useQuery(attributesOptions).data ?? []
  const [attr, setAttr] = useState<AttrForm>(EMPTY_ATTR)
  const [busy, setBusy] = useState(false)

  const [term, setTerm] = useState({ term: '', canonical: '', kind: 'synonym' as 'synonym' | 'tag' | 'stopword' })
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | 'synonym' | 'tag' | 'stopword'>('all')
  const [page, setPage] = useState(1)
  const dict = useQuery(dictionaryOptions({ q: q || undefined, kind, page })).data

  const saveAttrFn = useServerFn(saveAttribute)
  const delAttrFn = useServerFn(deleteAttribute)
  const saveTermFn = useServerFn(saveTerm)
  const delTermFn = useServerFn(deleteTerm)

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'attributes'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'dictionary'] })
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await invalidate()
      toast.success(ok)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal.')
    } finally {
      setBusy(false)
    }
  }

  const submitAttr = async () => {
    if (attr.name.trim().length < 2) {
      toast.error('Nama atribut minimal 2 karakter.')
      return
    }
    await run(async () => {
      await saveAttrFn({
        data: {
          id: attr.id,
          name: attr.name,
          key: attr.key || undefined,
          type: attr.type,
          allowedValues:
            attr.type === 'enum'
              ? attr.allowedCsv
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean)
              : [],
          weight: Number(attr.weight) || 1,
          isFilterable: attr.isFilterable,
          showInSpec: attr.showInSpec,
        },
      })
      setAttr(EMPTY_ATTR)
    }, attr.id ? 'Atribut diperbarui.' : 'Atribut ditambahkan.')
  }

  const dictTotalPages = dict ? Math.max(1, Math.ceil(dict.total / dict.pageSize)) : 1

  return (
    <>
      <div className="section-header">
        <h1>Atribut &amp; Kamus</h1>
      </div>
      <div className="section-body">
        <div className="row">
          <div className="col-lg-6">
            <div className="card mb-3">
              <div className="card-header">
                <h4>Atribut produk</h4>
              </div>
              <div className="card-body">
                <div className="table-responsive mb-3">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Key</th>
                        <th>Tipe</th>
                        <th>Bobot</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {attributes.map((a) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>
                            <code>{a.key}</code>
                          </td>
                          <td>{a.type}</td>
                          <td>{a.weight}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary mr-1"
                              disabled={busy}
                              onClick={() =>
                                setAttr({
                                  id: a.id,
                                  name: a.name,
                                  key: a.key,
                                  type: a.type,
                                  allowedCsv: (a.allowedValues ?? []).map(String).join(', '),
                                  weight: String(a.weight),
                                  isFilterable: a.isFilterable,
                                  showInSpec: a.showInSpec,
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() =>
                                void run(() => delAttrFn({ data: { id: a.id } }), 'Atribut dihapus.')
                              }
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                      {attributes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">
                            Belum ada atribut.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitAttr()
                  }}
                >
                  <h5 className="mb-3">{attr.id ? 'Edit atribut' : 'Tambah atribut'}</h5>
                  <div className="row">
                    <div className="form-group col-md-6">
                      <label>Nama *</label>
                      <input
                        className="form-control"
                        value={attr.name}
                        onChange={(e) => setAttr({ ...attr, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-6">
                      <label>Key (opsional)</label>
                      <input
                        className="form-control"
                        placeholder="otomatis dari nama"
                        value={attr.key}
                        onChange={(e) => setAttr({ ...attr, key: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label>Tipe</label>
                      <select
                        className="form-control"
                        value={attr.type}
                        onChange={(e) => setAttr({ ...attr, type: e.target.value as AttrForm['type'] })}
                      >
                        <option value="text">Teks</option>
                        <option value="enum">Enum</option>
                        <option value="number">Angka</option>
                        <option value="boolean">Ya/Tidak</option>
                      </select>
                    </div>
                    <div className="form-group col-md-4">
                      <label>Bobot (0–10)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        max={10}
                        step="0.1"
                        value={attr.weight}
                        onChange={(e) => setAttr({ ...attr, weight: e.target.value })}
                      />
                    </div>
                    {attr.type === 'enum' ? (
                      <div className="form-group col-md-4">
                        <label>Nilai (pisahkan koma)</label>
                        <input
                          className="form-control"
                          placeholder="S, M, L"
                          value={attr.allowedCsv}
                          onChange={(e) => setAttr({ ...attr, allowedCsv: e.target.value })}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="form-row mb-3">
                    <div className="col-auto form-check mr-3">
                      <label className="form-check-label">
                        <input
                          className="form-check-input mr-1"
                          type="checkbox"
                          checked={attr.isFilterable}
                          onChange={(e) => setAttr({ ...attr, isFilterable: e.target.checked })}
                        />
                        Bisa difilter
                      </label>
                    </div>
                    <div className="col-auto form-check">
                      <label className="form-check-label">
                        <input
                          className="form-check-input mr-1"
                          type="checkbox"
                          checked={attr.showInSpec}
                          onChange={(e) => setAttr({ ...attr, showInSpec: e.target.checked })}
                        />
                        Tampil di spesifikasi
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary mr-2" disabled={busy}>
                    {attr.id ? 'Simpan perubahan' : 'Tambah'}
                  </button>
                  {attr.id ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAttr(EMPTY_ATTR)}
                    >
                      Batal
                    </button>
                  ) : null}
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card mb-3">
              <div className="card-header">
                <h4>Kamus pencarian</h4>
              </div>
              <div className="card-body">
                <form
                  className="form-inline mb-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setPage(1)
                  }}
                >
                  <input
                    className="form-control mr-2 mb-2"
                    style={{ maxWidth: 200 }}
                    placeholder="Cari istilah…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setPage(1)
                    }}
                  />
                  <select
                    className="form-control mb-2"
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as typeof kind)
                      setPage(1)
                    }}
                  >
                    <option value="all">Semua jenis</option>
                    <option value="synonym">Sinonim</option>
                    <option value="tag">Tag</option>
                    <option value="stopword">Stopword</option>
                  </select>
                </form>

                <div className="table-responsive mb-3">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Istilah</th>
                        <th>Kanonik</th>
                        <th>Jenis</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(dict?.rows ?? []).map((t) => (
                        <tr key={t.id}>
                          <td>{t.term}</td>
                          <td>{t.canonical}</td>
                          <td>{KIND_LABEL[t.kind] ?? t.kind}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() =>
                                void run(() => delTermFn({ data: { id: t.id } }), 'Istilah dihapus.')
                              }
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(dict?.rows ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-muted">
                            Tidak ada istilah.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted text-sm">
                    {dict ? `${dict.total} istilah · halaman ${page}/${dictTotalPages}` : ''}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary mr-1"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={page >= dictTotalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!term.term.trim() || !term.canonical.trim()) {
                      toast.error('Istilah dan kanonik wajib diisi.')
                      return
                    }
                    void run(async () => {
                      await saveTermFn({ data: term })
                      setTerm({ term: '', canonical: '', kind: 'synonym' })
                    }, 'Istilah ditambahkan.')
                  }}
                >
                  <h5 className="mb-3">Tambah istilah</h5>
                  <div className="row">
                    <div className="form-group col-md-4">
                      <label>Istilah *</label>
                      <input
                        className="form-control"
                        value={term.term}
                        onChange={(e) => setTerm({ ...term, term: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label>Kanonik *</label>
                      <input
                        className="form-control"
                        value={term.canonical}
                        onChange={(e) => setTerm({ ...term, canonical: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label>Jenis</label>
                      <select
                        className="form-control"
                        value={term.kind}
                        onChange={(e) => setTerm({ ...term, kind: e.target.value as typeof term.kind })}
                      >
                        <option value="synonym">Sinonim</option>
                        <option value="tag">Tag</option>
                        <option value="stopword">Stopword</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Tambah
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
