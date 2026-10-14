import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  addProductImage,
  adminProductDetailOptions,
  attributesOptions,
  deleteProductImage,
  deleteVariant,
  saveProduct,
  saveProductAttributes,
  saveVariant,
} from '#/server/fn/admin'
import { categoriesOptions, imageUrl } from '#/server/fn/product'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, getR2UploadUrl } from '#/server/fn/storage'

export const Route = createFileRoute('/admin/produk/form')({
  validateSearch: z.object({ id: z.uuid().optional() }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(categoriesOptions)
    if (!deps.id) return { detail: null }
    return {
      detail: await context.queryClient.ensureQueryData(adminProductDetailOptions(deps.id)),
    }
  },
  component: ProdukFormPage,
})

type VariantRow = {
  id?: string
  sku: string
  colorName: string
  colorHex: string
  size: string
  stock: number
  salePriceOverride: string
}

function int(s: string): number {
  const n = Math.trunc(Number(s))
  return Number.isFinite(n) ? n : 0
}

function ProdukFormPage() {
  const { detail } = Route.useLoaderData()
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const categories = useQuery(categoriesOptions).data ?? []
  const attributes = useQuery(attributesOptions).data ?? []

  const saveProductFn = useServerFn(saveProduct)
  const saveVariantFn = useServerFn(saveVariant)
  const deleteVariantFn = useServerFn(deleteVariant)
  const addImageFn = useServerFn(addProductImage)
  const deleteImageFn = useServerFn(deleteProductImage)
  const saveAttrsFn = useServerFn(saveProductAttributes)
  const uploadFn = useServerFn(getR2UploadUrl)

  const p = detail?.product
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    (detail?.variants ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      colorName: v.colorName ?? '',
      colorHex: v.colorHex ?? '',
      size: v.size ?? '',
      stock: v.stock,
      salePriceOverride: v.salePriceOverride == null ? '' : String(v.salePriceOverride),
    })),
  )
  const [attrValues, setAttrValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const v of detail?.values ?? []) map[v.attributeId] = String(v.value)
    return map
  })
  const [busy, setBusy] = useState(false)

  const invalidateDetail = async () => {
    if (id) await queryClient.invalidateQueries({ queryKey: adminProductDetailOptions(id).queryKey })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
  }

  const form = useForm({
    defaultValues: {
      name: p?.name ?? '',
      categoryId: p?.categoryId ?? '',
      description: p?.description ?? '',
      brandLine: p?.brandLine ?? '',
      salePrice: p ? String(p.salePrice) : '',
      discountPercent: p ? String(p.discountPercent) : '0',
      rentPricePerDay: p?.rentPricePerDay != null ? String(p.rentPricePerDay) : '',
      rentDeposit: p ? String(p.rentDeposit) : '0',
      isSellable: p?.isSellable ?? true,
      isRentable: p?.isRentable ?? false,
      isPreorder: p?.isPreorder ?? false,
      isActive: p?.isActive ?? true,
      preorderDpPercent: p?.preorderDpPercent != null ? String(p.preorderDpPercent) : '',
      preorderEta: p?.preorderEta ? new Date(p.preorderEta).toISOString().slice(0, 10) : '',
    },
    onSubmit: async ({ value }) => {
      setBusy(true)
      try {
        const res = await saveProductFn({
          data: {
            id,
            name: value.name,
            categoryId: value.categoryId,
            description: value.description,
            brandLine: value.brandLine || undefined,
            salePrice: int(value.salePrice),
            discountPercent: int(value.discountPercent),
            rentPricePerDay: value.rentPricePerDay.trim() === '' ? null : int(value.rentPricePerDay),
            rentDeposit: int(value.rentDeposit),
            isSellable: value.isSellable,
            isRentable: value.isRentable,
            isPreorder: value.isPreorder,
            preorderEta:
              value.isPreorder && value.preorderEta
                ? new Date(`${value.preorderEta}T00:00:00Z`).toISOString()
                : null,
            preorderDpPercent:
              value.isPreorder && value.preorderDpPercent.trim() !== ''
                ? int(value.preorderDpPercent)
                : null,
            isActive: value.isActive,
          },
        })

        if (!id) {
          toast.success('Produk dibuat. Lanjut isi varian, gambar, dan atribut.')
          await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
          await navigate({ to: '/admin/produk/form', search: { id: res.id } })
          return
        }

        for (const v of variants) {
          if (!v.sku.trim()) continue
          await saveVariantFn({
            data: {
              productId: id,
              id: v.id,
              sku: v.sku,
              colorName: v.colorName || undefined,
              colorHex: /^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : undefined,
              size: v.size || undefined,
              stock: Math.max(0, int(String(v.stock))),
              salePriceOverride: v.salePriceOverride.trim() === '' ? null : int(v.salePriceOverride),
            },
          })
        }

        const values = attributes.flatMap((a) => {
          const raw = attrValues[a.id]
          if (!raw) return []
          const attrVal = a.type === 'number' ? Number(raw) : a.type === 'boolean' ? raw === 'true' : raw
          return [{ attributeId: a.id, value: attrVal }]
        })
        await saveAttrsFn({ data: { productId: id, values } })

        await invalidateDetail()
        toast.success('Perubahan disimpan.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan.')
      } finally {
        setBusy(false)
      }
    },
  })

  const removeVariant = async (row: VariantRow) => {
    if (row.id) {
      await deleteVariantFn({ data: { id: row.id } })
      await invalidateDetail()
    }
    setVariants((rows) => rows.filter((r) => r !== row))
  }

  const onPickImage = async (file: File | undefined) => {
    if (!file) return
    if (!id) {
      toast.error('Simpan produk terlebih dahulu.')
      return
    }
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Format gambar harus webp, jpg, atau png.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Ukuran gambar maksimal 5 MB.')
      return
    }
    setBusy(true)
    try {
      const res = await uploadFn({
        data: {
          fileName: file.name,
          contentType: file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
          size: file.size,
        },
      })
      await fetch(res.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      await addImageFn({ data: { productId: id, r2Key: res.key } })
      await invalidateDetail()
      toast.success('Gambar diunggah.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah gambar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-header">
        <h1>{id ? 'Edit Produk' : 'Tambah Produk'}</h1>
      </div>
      <div className="section-body">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="card mb-3">
            <div className="card-header">
              <h4>Info dasar</h4>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Nama produk *</label>
                <form.Field
                  name="name"
                  validators={{
                    onSubmit: ({ value }) =>
                      value.trim().length < 2 ? 'Minimal 2 karakter' : undefined,
                  }}
                  children={(field) => (
                    <>
                      <input
                        className="form-control"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <small className="text-danger">{field.state.meta.errors.join(', ')}</small>
                      ) : null}
                    </>
                  )}
                />
              </div>
              <div className="form-group">
                <label>Kategori *</label>
                <form.Field
                  name="categoryId"
                  validators={{
                    onSubmit: ({ value }) => (value ? undefined : 'Pilih kategori'),
                  }}
                  children={(field) => (
                    <>
                      <select
                        className="form-control"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option value="">— pilih —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {field.state.meta.errors.length > 0 ? (
                        <small className="text-danger">{field.state.meta.errors.join(', ')}</small>
                      ) : null}
                    </>
                  )}
                />
              </div>
              <div className="form-group">
                <label>Brand / lini produk</label>
                <form.Field
                  name="brandLine"
                  children={(field) => (
                    <input
                      className="form-control"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                />
              </div>
              <div className="form-group">
                <label>Deskripsi</label>
                <form.Field
                  name="description"
                  children={(field) => (
                    <textarea
                      className="form-control"
                      rows={4}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <h4>Harga &amp; sewa</h4>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="form-group col-md-3">
                  <label>Harga jual (Rp) *</label>
                  <form.Field
                    name="salePrice"
                    validators={{
                      onSubmit: ({ value }) =>
                        int(value) > 0 ? undefined : 'Masukkan harga jual',
                    }}
                    children={(field) => (
                      <>
                        <input
                          className="form-control"
                          type="number"
                          min={1}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors.length > 0 ? (
                          <small className="text-danger">{field.state.meta.errors.join(', ')}</small>
                        ) : null}
                      </>
                    )}
                  />
                </div>
                <div className="form-group col-md-3">
                  <label>Diskon (%)</label>
                  <form.Field
                    name="discountPercent"
                    children={(field) => (
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        max={90}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  />
                </div>
                <div className="form-group col-md-3">
                  <label>Sewa / hari (Rp)</label>
                  <form.Field
                    name="rentPricePerDay"
                    children={(field) => (
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        placeholder="kosong = tidak disewakan"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  />
                </div>
                <div className="form-group col-md-3">
                  <label>Deposit sewa (Rp)</label>
                  <form.Field
                    name="rentDeposit"
                    children={(field) => (
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <h4>Status &amp; pre-order</h4>
            </div>
            <div className="card-body">
              <div className="form-row mb-3">
                <div className="col-auto form-check">
                  <form.Field
                    name="isSellable"
                    children={(field) => (
                      <label className="form-check-label mr-3">
                        <input
                          className="form-check-input mr-1"
                          type="checkbox"
                          checked={field.state.value}
                          onChange={(e) => field.handleChange(e.target.checked)}
                        />
                        Dijual
                      </label>
                    )}
                  />
                </div>
                <div className="col-auto form-check">
                  <form.Field
                    name="isRentable"
                    children={(field) => (
                      <label className="form-check-label mr-3">
                        <input
                          className="form-check-input mr-1"
                          type="checkbox"
                          checked={field.state.value}
                          onChange={(e) => field.handleChange(e.target.checked)}
                        />
                        Disewakan
                      </label>
                    )}
                  />
                </div>
                <div className="col-auto form-check">
                  <form.Field
                    name="isPreorder"
                    children={(field) => (
                      <label className="form-check-label mr-3">
                        <input
                          className="form-check-input mr-1"
                          type="checkbox"
                          checked={field.state.value}
                          onChange={(e) => field.handleChange(e.target.checked)}
                        />
                        Pre-order
                      </label>
                    )}
                  />
                </div>
                <div className="col-auto form-check">
                  <form.Field
                    name="isActive"
                    children={(field) => (
                      <label className="form-check-label">
                        <input
                          className="form-check-input mr-1"
                          type="checkbox"
                          checked={field.state.value}
                          onChange={(e) => field.handleChange(e.target.checked)}
                        />
                        Aktif
                      </label>
                    )}
                  />
                </div>
              </div>
              <form.Subscribe
                selector={(s) => s.values.isPreorder}
                children={(isPreorder) =>
                  isPreorder ? (
                    <div className="row">
                      <div className="form-group col-md-4">
                        <label>DP pre-order (% total)</label>
                        <form.Field
                          name="preorderDpPercent"
                          children={(field) => (
                            <input
                              className="form-control"
                              type="number"
                              min={0}
                              max={100}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                          )}
                        />
                      </div>
                      <div className="form-group col-md-4">
                        <label>Estimasi kedatangan</label>
                        <form.Field
                          name="preorderEta"
                          children={(field) => (
                            <input
                              className="form-control"
                              type="date"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                          )}
                        />
                      </div>
                    </div>
                  ) : null
                }
              />
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="mb-0">Varian &amp; stok</h4>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  setVariants((rows) => [
                    ...rows,
                    { sku: '', colorName: '', colorHex: '', size: '', stock: 0, salePriceOverride: '' },
                  ])
                }
              >
                <i className="fas fa-plus" /> Tambah varian
              </button>
            </div>
            <div className="card-body table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>SKU *</th>
                    <th>Warna</th>
                    <th>Hex</th>
                    <th>Ukuran</th>
                    <th style={{ width: 110 }}>Stok</th>
                    <th style={{ width: 140 }}>Harga override</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((row, i) => (
                    <tr key={row.id ?? `new-${i}`}>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={row.sku}
                          onChange={(e) =>
                            setVariants((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, sku: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={row.colorName}
                          onChange={(e) =>
                            setVariants((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, colorName: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          placeholder="#ff0000"
                          value={row.colorHex}
                          onChange={(e) =>
                            setVariants((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, colorHex: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={row.size}
                          onChange={(e) =>
                            setVariants((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, size: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          type="number"
                          min={0}
                          value={row.stock}
                          onChange={(e) =>
                            setVariants((rows) =>
                              rows.map((r, j) =>
                                j === i ? { ...r, stock: Math.max(0, int(e.target.value)) } : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          type="number"
                          min={0}
                          placeholder="—"
                          value={row.salePriceOverride}
                          onChange={(e) =>
                            setVariants((rows) =>
                              rows.map((r, j) =>
                                j === i ? { ...r, salePriceOverride: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busy}
                          onClick={() => void removeVariant(row)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {variants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">
                        Belum ada varian.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <small className="text-muted">
                Perubahan varian tersimpan bersama tombol Simpan di bawah.
              </small>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <h4>Gambar</h4>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap mb-3">
                {(detail?.images ?? []).map((img) => (
                  <div key={img.id} className="mr-2 mb-2 text-center">
                    <img
                      src={imageUrl(img.r2Key)}
                      alt={img.alt}
                      width={84}
                      height={84}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                    />
                    <div>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-0"
                        disabled={busy}
                        onClick={async () => {
                          await deleteImageFn({ data: { id: img.id } })
                          await invalidateDetail()
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
                {(detail?.images ?? []).length === 0 ? (
                  <p className="text-muted mb-2">Belum ada gambar.</p>
                ) : null}
              </div>
              <input
                type="file"
                accept="image/webp,image/jpeg,image/png"
                disabled={busy || !id}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  void onPickImage(file)
                }}
              />
              {!id ? (
                <small className="text-muted d-block mt-1">
                  Gambar bisa diunggah setelah produk disimpan.
                </small>
              ) : null}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <h4>Atribut</h4>
            </div>
            <div className="card-body">
              {attributes.length === 0 ? (
                <p className="text-muted mb-0">Belum ada atribut. Buat di menu Atribut &amp; Kamus.</p>
              ) : (
                <div className="row">
                  {attributes.map((a) => (
                    <div className="form-group col-md-4" key={a.id}>
                      <label>{a.name}</label>
                      {a.type === 'enum' ? (
                        <select
                          className="form-control"
                          value={attrValues[a.id] ?? ''}
                          onChange={(e) =>
                            setAttrValues((m) => ({ ...m, [a.id]: e.target.value }))
                          }
                        >
                          <option value="">— pilih —</option>
                          {(a.allowedValues ?? []).map((v) => (
                            <option key={String(v)} value={String(v)}>
                              {String(v)}
                            </option>
                          ))}
                        </select>
                      ) : a.type === 'boolean' ? (
                        <select
                          className="form-control"
                          value={attrValues[a.id] ?? ''}
                          onChange={(e) =>
                            setAttrValues((m) => ({ ...m, [a.id]: e.target.value }))
                          }
                        >
                          <option value="">— pilih —</option>
                          <option value="true">Ya</option>
                          <option value="false">Tidak</option>
                        </select>
                      ) : (
                        <input
                          className="form-control"
                          type={a.type === 'number' ? 'number' : 'text'}
                          value={attrValues[a.id] ?? ''}
                          onChange={(e) =>
                            setAttrValues((m) => ({ ...m, [a.id]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="d-flex mb-5">
            <button type="submit" className="btn btn-primary mr-2" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void navigate({ to: '/admin/produk' })}>
              Batal
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
