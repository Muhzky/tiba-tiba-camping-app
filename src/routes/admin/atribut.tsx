import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import {
  attributesOptions,
  deleteAttribute,
  deleteTerm,
  dictionaryOptions,
  saveAttribute,
  saveTerm,
} from '#/server/fn/admin'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { AdminPagination } from '#/components/admin/pagination'
import { Field, SearchInput, SelectInput } from '#/components/admin/field'
import { AdminButton, buttonClass } from '#/components/admin/button'

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

  return (
    <AdminPage
      title="Atribut &amp; Kamus"
      description="Atur spesifikasi produk dan kosakata pencarian (sinonim, tag, stopword)."
    >
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <AdminCard title="Atribut produk" bodyClassName="p-0">
          <div className="p-4">
            <AdminTable
              head={
                <>
                  <th scope="col">Nama</th>
                  <th scope="col">Key</th>
                  <th scope="col">Tipe</th>
                  <th scope="col" className="text-right">
                    Bobot
                  </th>
                  <th scope="col" />
                </>
              }
            >
              {attributes.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>
                    <code>{a.key}</code>
                  </td>
                  <td>{a.type}</td>
                  <td className="text-right">{a.weight}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      <AdminButton
                        size="sm"
                        variant="neutral"
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
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(() => delAttrFn({ data: { id: a.id } }), 'Atribut dihapus.')
                        }
                      >
                        Hapus
                      </AdminButton>
                    </div>
                  </td>
                </tr>
              ))}
              {attributes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground">
                    Belum ada atribut.
                  </td>
                </tr>
              ) : null}
            </AdminTable>
          </div>

          <form
            className="border-t p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submitAttr()
            }}
          >
            <h3 className="mb-3 text-sm font-semibold">
              {attr.id ? 'Edit atribut' : 'Tambah atribut'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nama" htmlFor="attr-name" required>
                <input
                  id="attr-name"
                  className="input"
                  value={attr.name}
                  onChange={(e) => setAttr({ ...attr, name: e.target.value })}
                />
              </Field>
              <Field label="Key (opsional)" htmlFor="attr-key">
                <input
                  id="attr-key"
                  className="input"
                  placeholder="otomatis dari nama"
                  value={attr.key}
                  onChange={(e) => setAttr({ ...attr, key: e.target.value })}
                />
              </Field>
              <Field label="Tipe" htmlFor="attr-type">
                <SelectInput
                  ariaLabel="Tipe atribut"
                  value={attr.type}
                  onChange={(value) => setAttr({ ...attr, type: value as AttrForm['type'] })}
                  options={[
                    { value: 'text', label: 'Teks' },
                    { value: 'enum', label: 'Enum' },
                    { value: 'number', label: 'Angka' },
                    { value: 'boolean', label: 'Ya/Tidak' },
                  ]}
                />
              </Field>
              <Field label="Bobot (0–10)" htmlFor="attr-weight">
                <input
                  id="attr-weight"
                  className="input"
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={attr.weight}
                  onChange={(e) => setAttr({ ...attr, weight: e.target.value })}
                />
              </Field>
              {attr.type === 'enum' ? (
                <Field
                  label="Nilai (pisahkan koma)"
                  htmlFor="attr-allowed"
                  className="sm:col-span-2"
                >
                  <input
                    id="attr-allowed"
                    className="input"
                    placeholder="S, M, L"
                    value={attr.allowedCsv}
                    onChange={(e) => setAttr({ ...attr, allowedCsv: e.target.value })}
                  />
                </Field>
              ) : null}
            </div>
            <div className="mb-3 mt-1 flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={attr.isFilterable}
                  onChange={(e) => setAttr({ ...attr, isFilterable: e.target.checked })}
                />
                Bisa difilter
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={attr.showInSpec}
                  onChange={(e) => setAttr({ ...attr, showInSpec: e.target.checked })}
                />
                Tampil di spesifikasi
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className={buttonClass({ variant: 'primary' })}
                disabled={busy}
              >
                <Plus aria-hidden="true" />
                {attr.id ? 'Simpan perubahan' : 'Tambah'}
              </button>
              {attr.id ? (
                <AdminButton variant="neutral" onClick={() => setAttr(EMPTY_ATTR)}>
                  Batal
                </AdminButton>
              ) : null}
            </div>
          </form>
        </AdminCard>

        <AdminCard title="Kamus pencarian" bodyClassName="p-0">
          <form
            className="flex flex-wrap items-center gap-2 border-b p-4"
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
            }}
          >
            <SearchInput
              label="istilah"
              placeholder="Cari istilah…"
              className="w-full sm:w-56"
              value={q}
              onChange={(value) => {
                setQ(value)
                setPage(1)
              }}
            />
            <SelectInput
              ariaLabel="Jenis istilah"
              className="w-full sm:w-44"
              value={kind}
              onChange={(value) => {
                setKind(value as typeof kind)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'Semua jenis' },
                { value: 'synonym', label: 'Sinonim' },
                { value: 'tag', label: 'Tag' },
                { value: 'stopword', label: 'Stopword' },
              ]}
            />
          </form>

          <div className="p-4">
            <AdminTable
              head={
                <>
                  <th scope="col">Istilah</th>
                  <th scope="col">Kanonik</th>
                  <th scope="col">Jenis</th>
                  <th scope="col" />
                </>
              }
            >
              {(dict?.rows ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.term}</td>
                  <td>{t.canonical}</td>
                  <td>{KIND_LABEL[t.kind] ?? t.kind}</td>
                  <td>
                    <div className="flex justify-end">
                      <AdminButton
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(() => delTermFn({ data: { id: t.id } }), 'Istilah dihapus.')
                        }
                      >
                        Hapus
                      </AdminButton>
                    </div>
                  </td>
                </tr>
              ))}
              {(dict?.rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground">
                    Tidak ada istilah.
                  </td>
                </tr>
              ) : null}
            </AdminTable>

            <AdminPagination
              page={page}
              pageSize={dict?.pageSize ?? 20}
              total={dict?.total ?? 0}
              unitLabel="istilah"
              onPage={setPage}
            />
          </div>

          <form
            className="border-t p-4"
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
            <h3 className="mb-3 text-sm font-semibold">Tambah istilah</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Istilah" htmlFor="term-term" required>
                <input
                  id="term-term"
                  className="input"
                  value={term.term}
                  onChange={(e) => setTerm({ ...term, term: e.target.value })}
                />
              </Field>
              <Field label="Kanonik" htmlFor="term-canonical" required>
                <input
                  id="term-canonical"
                  className="input"
                  value={term.canonical}
                  onChange={(e) => setTerm({ ...term, canonical: e.target.value })}
                />
              </Field>
              <Field label="Jenis" htmlFor="term-kind">
                <SelectInput
                  ariaLabel="Jenis istilah baru"
                  value={term.kind}
                  onChange={(value) => setTerm({ ...term, kind: value as typeof term.kind })}
                  options={[
                    { value: 'synonym', label: 'Sinonim' },
                    { value: 'tag', label: 'Tag' },
                    { value: 'stopword', label: 'Stopword' },
                  ]}
                />
              </Field>
            </div>
            <button
              type="submit"
              className={buttonClass({ variant: 'primary' })}
              disabled={busy}
            >
              <Plus aria-hidden="true" />
              Tambah
            </button>
          </form>
        </AdminCard>
      </div>
    </AdminPage>
  )
}
