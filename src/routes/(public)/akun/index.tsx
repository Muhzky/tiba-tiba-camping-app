import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'
import { MapPin, Trash2 } from 'lucide-react'
import type {
  addressSchema} from '#/server/fn/account';
import {
  addressesOptions,
  deleteAddress,
  saveAddress,
} from '#/server/fn/account'
import { myOrdersOptions } from '#/server/fn/order'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { rupiah } from '#/lib/format'

export const Route = createFileRoute('/(public)/akun/')({
  component: AkunHome,
})

const emptyAddress = {
  label: '',
  recipient: '',
  phone: '',
  street: '',
  city: '',
  province: '',
  postalCode: '',
  isDefault: false,
}

function AkunHome() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const { data: addresses } = useQuery(addressesOptions)
  const { data: orders } = useQuery(myOrdersOptions)
  const [showForm, setShowForm] = useState(false)

  const save = useServerFn(saveAddress)
  const remove = useServerFn(deleteAddress)
  const saveMutation = useMutation({
    mutationFn: (value: z.infer<typeof addressSchema>) => save({ data: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: addressesOptions.queryKey })
      toast.success('Alamat tersimpan.')
      setShowForm(false)
      form.reset(emptyAddress)
    },
    onError: () => toast.error('Gagal menyimpan alamat.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: addressesOptions.queryKey })
      toast.success('Alamat dihapus.')
    },
  })

  const form = useForm({
    defaultValues: emptyAddress,
    onSubmit: async ({ value }) => {
      saveMutation.mutate({
        ...value,
        label: value.label || null,
        recipient: value.recipient.trim(),
        phone: value.phone.trim(),
        street: value.street.trim(),
        city: value.city.trim(),
        province: value.province.trim(),
        postalCode: value.postalCode.trim(),
      })
    },
  })

  const totalSpent = orders?.reduce((sum, o) => (o.status === 'cancelled' ? sum : sum + o.grandTotal), 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[24px] border border-border/70 bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">Ringkasan Akun</h1>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Pesanan" value={String(orders?.length ?? 0)} />
          <Stat label="Total belanja" value={rupiah(totalSpent)} />
          <Stat label="Peran" value={user.role} />
        </div>
        <dl className="mt-5 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Nama</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate font-medium">{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[24px] border border-border/70 bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <MapPin className="size-4 text-primary" /> Alamat
          </h2>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Tutup' : 'Tambah alamat'}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {addresses?.length ? (
            addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-surface/50 p-4"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {addr.recipient}
                    {addr.label ? <span className="ml-2 text-xs text-muted-foreground">({addr.label})</span> : null}
                    {addr.isDefault ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Utama
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {addr.street}, {addr.city}, {addr.province} {addr.postalCode}
                  </p>
                  <p className="text-muted-foreground">Telp: {addr.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus alamat"
                  className="text-sale hover:text-sale"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(addr.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada alamat tersimpan.</p>
          )}
        </div>

        {showForm ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
            className="mt-5 grid gap-4 rounded-2xl border border-border/70 bg-surface/50 p-4 sm:grid-cols-2"
          >
            <form.Field
              name="label"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Label (opsional)</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Rumah, Kantor…"
                  />
                </div>
              )}
            />
            <form.Field
              name="recipient"
              validators={{
                onSubmit: ({ value }) => (value.trim().length >= 2 ? undefined : 'Nama penerima wajib'),
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Nama penerima</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p role="alert" className="text-xs text-sale">
                      {field.state.meta.errors.map(String).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <form.Field
              name="phone"
              validators={{
                onSubmit: ({ value }) =>
                  /^0\d{8,12}$/.test(value.trim()) ? undefined : 'Nomor HP tidak valid',
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>No. HP</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="081234567890"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p role="alert" className="text-xs text-sale">
                      {field.state.meta.errors.map(String).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <form.Field
              name="postalCode"
              validators={{
                onSubmit: ({ value }) => (/^\d{5}$/.test(value.trim()) ? undefined : 'Kode pos 5 digit'),
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Kode pos</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    inputMode="numeric"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p role="alert" className="text-xs text-sale">
                      {field.state.meta.errors.map(String).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <form.Field
              name="street"
              validators={{
                onSubmit: ({ value }) => (value.trim().length >= 5 ? undefined : 'Alamat jalan terlalu pendek'),
              }}
              children={(field) => (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={field.name}>Alamat jalan</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Jl. Melati No. 1, RT 02/RW 05"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p role="alert" className="text-xs text-sale">
                      {field.state.meta.errors.map(String).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <form.Field
              name="city"
              validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Kota wajib diisi') }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Kota</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p role="alert" className="text-xs text-sale">
                      {field.state.meta.errors.map(String).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <form.Field
              name="province"
              validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Provinsi wajib diisi') }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Provinsi</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p role="alert" className="text-xs text-sale">
                      {field.state.meta.errors.map(String).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <form.Field
              name="isDefault"
              children={(field) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  Jadikan alamat utama
                </label>
              )}
            />
            <div className="sm:col-span-2">
              <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Menyimpan…' : 'Simpan alamat'}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight capitalize">{value}</p>
    </div>
  )
}
