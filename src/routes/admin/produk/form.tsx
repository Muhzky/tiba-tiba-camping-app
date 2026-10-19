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
import { ArrowLeft, ImagePlus, Plus } from 'lucide-react'
import { categoriesOptions, imageUrl } from '#/server/fn/product'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, getR2UploadUrl } from '#/server/fn/storage'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { Field } from '#/components/admin/field'
import { AdminButton, buttonClass } from '#/components/admin/button'

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

/** Ambil error submit pertama sebuah field TanStack Form (untuk prop `error` Field). */
function formError<TForm extends { getFieldMeta: (field: never) => { errors?: readonly unknown[] } | undefined }>(
  form: TForm,
  name: Parameters<TForm['getFieldMeta']>[0],
): string | undefined {
  const errors = form.getFieldMeta(name)?.errors
  if (!errors || errors.length === 0) return undefined
  return errors.map((e) => String(e)).join(', ')
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
    <AdminPage
      title={id ? 'Edit Produk' : 'Tambah Produk'}
      description={
        id
          ? 'Perbarui info, harga, varian, gambar, dan atribut produk.'
          : 'Isi info dasar dulu; varian, gambar, dan atribut menyusul setelah disimpan.'
      }
      breadcrumb={[{ label: 'Kelola Produk', to: '/admin/produk' }, { label: id ? 'Edit' : 'Tambah' }]}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <AdminCard title="Info dasar">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Nama produk"
              htmlFor="product-name"
              required
              error={formError(form, 'name')}
              className="md:col-span-2"
            >
              <form.Field
                name="name"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim().length < 2 ? 'Minimal 2 karakter' : undefined,
                }}
                children={(field) => (
                  <input
                    id="product-name"
                    className="input"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
            <Field
              label="Kategori"
              htmlFor="product-category"
              required
              error={formError(form, 'categoryId')}
            >
              <form.Field
                name="categoryId"
                validators={{
                  onSubmit: ({ value }) => (value ? undefined : 'Pilih kategori'),
                }}
                children={(field) => (
                  <select
                    id="product-category"
                    className="select"
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
                )}
              />
            </Field>
            <Field label="Brand / lini produk" htmlFor="product-brand">
              <form.Field
                name="brandLine"
                children={(field) => (
                  <input
                    id="product-brand"
                    className="input"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
            <Field
              label="Deskripsi"
              htmlFor="product-description"
              className="md:col-span-2"
            >
              <form.Field
                name="description"
                children={(field) => (
                  <textarea
                    id="product-description"
                    className="textarea"
                    rows={4}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
          </div>
        </AdminCard>

        <AdminCard title="Harga &amp; sewa">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Harga jual (Rp)"
              htmlFor="product-price"
              required
              error={formError(form, 'salePrice')}
            >
              <form.Field
                name="salePrice"
                validators={{
                  onSubmit: ({ value }) =>
                    int(value) > 0 ? undefined : 'Masukkan harga jual',
                }}
                children={(field) => (
                  <input
                    id="product-price"
                    className="input"
                    type="number"
                    min={1}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
            <Field label="Diskon (%)" htmlFor="product-discount">
              <form.Field
                name="discountPercent"
                children={(field) => (
                  <input
                    id="product-discount"
                    className="input"
                    type="number"
                    min={0}
                    max={90}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
            <Field
              label="Sewa / hari (Rp)"
              htmlFor="product-rent"
              description="kosong = tidak disewakan"
            >
              <form.Field
                name="rentPricePerDay"
                children={(field) => (
                  <input
                    id="product-rent"
                    className="input"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
            <Field label="Deposit sewa (Rp)" htmlFor="product-deposit">
              <form.Field
                name="rentDeposit"
                children={(field) => (
                  <input
                    id="product-deposit"
                    className="input"
                    type="number"
                    min={0}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            </Field>
          </div>
        </AdminCard>

        <AdminCard title="Status &amp; pre-order">
          <div className="mb-3 flex flex-wrap gap-4">
            <form.Field
              name="isSellable"
              children={(field) => (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                  Dijual
                </label>
              )}
            />
            <form.Field
              name="isRentable"
              children={(field) => (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                  Disewakan
                </label>
              )}
            />
            <form.Field
              name="isPreorder"
              children={(field) => (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                  Pre-order
                </label>
              )}
            />
            <form.Field
              name="isActive"
              children={(field) => (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                  Aktif
                </label>
              )}
            />
          </div>
          <form.Subscribe
            selector={(s) => s.values.isPreorder}
            children={(isPreorder) =>
              isPreorder ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="DP pre-order (% total)" htmlFor="product-dp">
                    <form.Field
                      name="preorderDpPercent"
                      children={(field) => (
                        <input
                          id="product-dp"
                          className="input"
                          type="number"
                          min={0}
                          max={100}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      )}
                    />
                  </Field>
                  <Field label="Estimasi kedatangan" htmlFor="product-eta">
                    <form.Field
                      name="preorderEta"
                      children={(field) => (
                        <input
                          id="product-eta"
                          className="input"
                          type="date"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      )}
                    />
                  </Field>
                </div>
              ) : null
            }
          />
        </AdminCard>

        <AdminCard
          title="Varian &amp; stok"
          actions={
            <AdminButton
              size="sm"
              variant="neutral"
              onClick={() =>
                setVariants((rows) => [
                  ...rows,
                  { sku: '', colorName: '', colorHex: '', size: '', stock: 0, salePriceOverride: '' },
                ])
              }
            >
              <Plus aria-hidden="true" />
              Tambah varian
            </AdminButton>
          }
          bodyClassName="p-0"
        >
          <AdminTable
            head={
              <>
                <th scope="col">SKU</th>
                <th scope="col">Warna</th>
                <th scope="col">Hex</th>
                <th scope="col">Ukuran</th>
                <th scope="col" className="w-[110px]">
                  Stok
                </th>
                <th scope="col" className="w-[140px]">
                  Harga override
                </th>
                <th scope="col" />
              </>
            }
          >
            {variants.map((row, i) => (
              <tr key={row.id ?? `new-${i}`}>
                <td>
                  <input
                    className="input"
                    value={row.sku}
                    aria-label={`SKU varian ${i + 1}`}
                    onChange={(e) =>
                      setVariants((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, sku: e.target.value } : r)),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={row.colorName}
                    aria-label={`Warna varian ${i + 1}`}
                    onChange={(e) =>
                      setVariants((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, colorName: e.target.value } : r)),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    placeholder="#ff0000"
                    value={row.colorHex}
                    aria-label={`Hex varian ${i + 1}`}
                    onChange={(e) =>
                      setVariants((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, colorHex: e.target.value } : r)),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={row.size}
                    aria-label={`Ukuran varian ${i + 1}`}
                    onChange={(e) =>
                      setVariants((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, size: e.target.value } : r)),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={row.stock}
                    aria-label={`Stok varian ${i + 1}`}
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
                    className="input"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={row.salePriceOverride}
                    aria-label={`Harga override varian ${i + 1}`}
                    onChange={(e) =>
                      setVariants((rows) =>
                        rows.map((r, j) =>
                          j === i ? { ...r, salePriceOverride: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <div className="flex justify-end">
                    <AdminButton
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void removeVariant(row)}
                    >
                      Hapus
                    </AdminButton>
                  </div>
                </td>
              </tr>
            ))}
            {variants.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground">
                  Belum ada varian.
                </td>
              </tr>
            ) : null}
          </AdminTable>
          <p className="p-4 pt-2 text-xs text-muted-foreground">
            Perubahan varian tersimpan bersama tombol Simpan di bawah.
          </p>
        </AdminCard>

        <AdminCard title="Gambar">
          <div className="mb-3 flex flex-wrap gap-2">
            {(detail?.images ?? []).map((img) => (
              <div key={img.id} className="text-center">
                <img
                  src={imageUrl(img.r2Key)}
                  alt={img.alt}
                  width={84}
                  height={84}
                  className="rounded-md object-cover"
                />
                <div>
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      await deleteImageFn({ data: { id: img.id } })
                      await invalidateDetail()
                    }}
                  >
                    Hapus
                  </AdminButton>
                </div>
              </div>
            ))}
            {(detail?.images ?? []).length === 0 ? (
              <p className="text-muted-foreground">Belum ada gambar.</p>
            ) : null}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <ImagePlus aria-hidden="true" />
            <span className={buttonClass({ variant: 'neutral', size: 'sm' })}>
              Pilih gambar
            </span>
            <input
              type="file"
              accept="image/webp,image/jpeg,image/png"
              className="hidden"
              disabled={busy || !id}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void onPickImage(file)
              }}
            />
          </label>
          {!id ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Gambar bisa diunggah setelah produk disimpan.
            </p>
          ) : null}
        </AdminCard>

        <AdminCard title="Atribut">
          {attributes.length === 0 ? (
            <p className="text-muted-foreground">
              Belum ada atribut. Buat di menu Atribut &amp; Kamus.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {attributes.map((a) => (
                <Field label={a.name} htmlFor={`attr-${a.id}`} key={a.id}>
                  {a.type === 'enum' ? (
                    <select
                      id={`attr-${a.id}`}
                      className="select"
                      value={attrValues[a.id] ?? ''}
                      onChange={(e) => setAttrValues((m) => ({ ...m, [a.id]: e.target.value }))}
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
                      id={`attr-${a.id}`}
                      className="select"
                      value={attrValues[a.id] ?? ''}
                      onChange={(e) => setAttrValues((m) => ({ ...m, [a.id]: e.target.value }))}
                    >
                      <option value="">— pilih —</option>
                      <option value="true">Ya</option>
                      <option value="false">Tidak</option>
                    </select>
                  ) : (
                    <input
                      id={`attr-${a.id}`}
                      className="input"
                      type={a.type === 'number' ? 'number' : 'text'}
                      value={attrValues[a.id] ?? ''}
                      onChange={(e) => setAttrValues((m) => ({ ...m, [a.id]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
            </div>
          )}
        </AdminCard>

        <div className="mt-4 mb-6 flex flex-wrap gap-2">
          <button type="submit" className={buttonClass({ variant: 'primary' })} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button
            type="button"
            className={buttonClass({ variant: 'neutral' })}
            onClick={() => void navigate({ to: '/admin/produk' })}
          >
            <ArrowLeft aria-hidden="true" />
            Batal
          </button>
        </div>
      </form>
    </AdminPage>
  )
}
