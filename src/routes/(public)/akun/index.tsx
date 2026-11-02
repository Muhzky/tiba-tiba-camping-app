import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { addressSchema, profileSchema } from '#/server/fn/account'
import {
  addressesOptions,
  deleteAddress,
  profileOptions,
  saveAddress,
  updateProfile,
} from '#/server/fn/account'
import { meOptions } from '#/server/fn/auth'
import { myOrdersOptions } from '#/server/fn/order'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  getAvatarUploadUrl,
} from '#/server/fn/storage'
import { Button } from '#/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { Badge } from '#/components/ui/badge'
import {
  AccountEmptyState,
  AccountPageHeader,
  AccountSection,
  accountCard,
  statusToneBadge,
} from '#/components/site/AccountUI'
import { rupiah } from '#/lib/format'
import {
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  orderStatusTone,
} from '#/lib/order-status'

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

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const AVATAR_SIZE = 320
const AVATAR_QUALITY = 0.85

type PreparedAvatar = {
  blob: Blob
  contentType: 'image/jpeg'
  fileName: string
  dataUrl: string
}

/**
 * Crop to a square, downscale and re-encode so avatars stay small enough to
 * upload to R2 — or, when storage isn't configured, to inline as a data URL.
 */
async function prepareAvatar(file: File): Promise<PreparedAvatar | null> {
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      const context = canvas.getContext('2d')
      if (!context) return null
      const side = Math.min(bitmap.width, bitmap.height)
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      )
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', AVATAR_QUALITY)
      })
      if (!blob) return null
      return {
        blob,
        contentType: 'image/jpeg',
        fileName: `${file.name.replace(/\.[^.]+$/, '') || 'avatar'}.jpg`,
        dataUrl: canvas.toDataURL('image/jpeg', AVATAR_QUALITY),
      }
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}

function AkunHome() {
  const { user: routeUser } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const { data: addresses } = useQuery(addressesOptions)
  const { data: orders } = useQuery(myOrdersOptions)
  const { data: me } = useQuery(meOptions)
  const { data: profile } = useQuery(profileOptions)
  // `me` is invalidated after a profile update, so the header, sidebar and
  // navbar all reflect the new name/photo without a reload. `null` berarti
  // sudah logout — jangan fallback ke user dari loader.
  const user = me === undefined ? routeUser : me
  const [showForm, setShowForm] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(false)
  // `undefined` = follow the saved profile image, so the preview stays correct
  // even when the profile query finishes after the form is opened.
  const [avatarOverride, setAvatarOverride] = useState<
    string | null | undefined
  >(undefined)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const savedImage = profile?.image ?? null
  const currentImage =
    avatarOverride === undefined ? savedImage : avatarOverride

  const save = useServerFn(saveAddress)
  const remove = useServerFn(deleteAddress)
  const saveProfile = useServerFn(updateProfile)
  const uploadAvatar = useServerFn(getAvatarUploadUrl)
  const saveMutation = useMutation({
    mutationFn: (value: z.infer<typeof addressSchema>) => save({ data: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: addressesOptions.queryKey,
      })
      toast.success('Alamat tersimpan.')
      setShowForm(false)
      form.reset(emptyAddress)
    },
    onError: () => toast.error('Gagal menyimpan alamat.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: addressesOptions.queryKey,
      })
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

  const profileMutation = useMutation({
    mutationFn: (value: z.infer<typeof profileSchema>) =>
      saveProfile({ data: value }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: meOptions.queryKey }),
      ])
      toast.success('Profil diperbarui.')
      setAvatarOverride(undefined)
      setShowProfileForm(false)
    },
    onError: () => toast.error('Gagal menyimpan profil.'),
  })

  const profileForm = useForm({
    defaultValues: {
      name: profile?.name ?? user?.name ?? '',
      phone: profile?.phone ?? '',
      image: profile?.image ?? null,
    },
    onSubmit: async ({ value }) => {
      profileMutation.mutate({
        name: value.name.trim(),
        phone: value.phone.trim() || null,
        image: currentImage,
      })
    },
  })

  function startProfileEdit() {
    profileForm.reset({
      name: profile?.name ?? user?.name ?? '',
      phone: profile?.phone ?? '',
      image: profile?.image ?? null,
    })
    setAvatarOverride(undefined)
    setShowProfileForm(true)
  }

  function cancelProfileEdit() {
    setShowProfileForm(false)
    setAvatarOverride(undefined)
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      )
    ) {
      toast.error('Format foto harus JPG, PNG, atau WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Ukuran foto maksimal 5 MB.')
      return
    }

    setAvatarBusy(true)
    try {
      const prepared = await prepareAvatar(file)
      const target = await uploadAvatar({
        data: {
          fileName: prepared?.fileName ?? file.name,
          contentType:
            prepared?.contentType ??
            (file.type as (typeof ALLOWED_IMAGE_TYPES)[number]),
          size: prepared?.blob.size ?? file.size,
        },
      })

      let nextImage: string
      if (target.mode === 'r2') {
        try {
          const response = await fetch(target.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': prepared?.contentType ?? file.type,
            },
            body: prepared?.blob ?? file,
          })
          if (!response.ok) throw new Error('UPLOAD_FAILED')
          nextImage = target.publicUrl
        } catch {
          // Storage hiccup: keep the photo on the profile row instead of
          // dropping the user's change.
          if (!prepared) throw new Error('UPLOAD_FAILED')
          nextImage = prepared.dataUrl
        }
      } else {
        if (!prepared) throw new Error('UPLOAD_FAILED')
        nextImage = prepared.dataUrl
      }

      setAvatarOverride(nextImage)
      profileForm.setFieldValue('image', nextImage)
      toast.success('Foto profil siap disimpan.')
    } catch {
      toast.error('Gagal mengunggah foto. Coba lagi.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const totalSpent =
    orders?.reduce(
      (sum, order) =>
        order.status === 'cancelled' ? sum : sum + order.grandTotal,
      0,
    ) ?? 0
  const pendingCount =
    orders?.filter((order) => order.status === 'pending_payment').length ?? 0
  const defaultAddress =
    addresses?.find((address) => address.isDefault) ?? addresses?.[0]
  const recentOrders = orders?.slice(0, 3) ?? []

  // Layout sudah menjaga ini, tapi jaga-jaga agar tidak merender data user
  // lama saat query `me` baru saja berubah menjadi null.
  if (!user) return null

  const roleLabel = user.role === 'admin' ? 'Admin' : 'Pelanggan'
  const profileName = profile?.name ?? user.name
  const profileEmail = profile?.email ?? user.email
  const profileImage = showProfileForm ? currentImage : savedImage
  const profileInitial = profileName.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <div className="flex flex-col gap-7">
      <AccountPageHeader
        title="Ringkasan Akun"
        description="Pantau pesanan dan kelola alamat pengirimanmu dari satu tempat."
        actions={
          <Badge
            variant="outline"
            className="h-6 rounded-full border-border/60 bg-card px-3 text-[11px] font-medium text-muted-foreground"
          >
            {roleLabel}
          </Badge>
        }
      />

      <section
        aria-label="Statistik akun"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/70 shadow-sm sm:grid-cols-3"
      >
        <Stat
          icon={Receipt}
          label="Pesanan"
          value={String(orders?.length ?? 0)}
          note={
            pendingCount > 0
              ? `${pendingCount} menunggu pembayaran`
              : 'Tidak ada tagihan'
          }
        />
        <Stat
          icon={Wallet}
          label="Total belanja"
          value={rupiah(totalSpent)}
          note="Tidak termasuk pesanan batal"
        />
        <Stat
          icon={MapPin}
          label="Alamat"
          value={String(addresses?.length ?? 0)}
          note={
            defaultAddress
              ? `Utama · ${defaultAddress.city}`
              : 'Belum ada alamat'
          }
          className="col-span-2 sm:col-span-1"
        />
      </section>

      <AccountSection
        id="profil-heading"
        title="Profil"
        description="Foto dan data diri yang dipakai saat checkout."
        action={
          <Button
            type="button"
            size="sm"
            variant={showProfileForm ? 'ghost' : 'outline'}
            className="h-8 rounded-full px-3 text-xs"
            aria-expanded={showProfileForm}
            aria-controls="profil-form"
            onClick={() => {
              if (showProfileForm) cancelProfileEdit()
              else startProfileEdit()
            }}
          >
            {showProfileForm ? (
              'Tutup'
            ) : (
              <>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit profil
              </>
            )}
          </Button>
        }
      >
        <div className={cn(accountCard, 'overflow-hidden')}>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-start">
              <Avatar className="size-16 after:border-border/70 sm:size-20">
                {profileImage ? (
                  <AvatarImage
                    src={profileImage}
                    alt={`Foto profil ${profileName}`}
                  />
                ) : null}
                <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground sm:text-xl">
                  {profileInitial}
                </AvatarFallback>
              </Avatar>
              {showProfileForm ? (
                <label
                  className={cn(
                    'absolute -bottom-1 -right-1 grid size-7 cursor-pointer place-items-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition hover:bg-surface focus-within:ring-3 focus-within:ring-ring/50',
                    avatarBusy && 'pointer-events-none opacity-60',
                  )}
                >
                  <Camera className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Ganti foto profil</span>
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png"
                    className="sr-only"
                    disabled={avatarBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      void handleAvatarFile(file)
                    }}
                  />
                </label>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold tracking-tight">
                  {profileName}
                </p>
                <Badge
                  variant="secondary"
                  className="h-5 rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary"
                >
                  {roleLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {avatarBusy
                  ? 'Mengunggah foto…'
                  : 'Data diri yang dipakai untuk pesanan dan pengiriman.'}
              </p>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[1.5fr_1fr_1fr]">
                <Biodata icon={Mail} label="Email" value={profileEmail} />
                <Biodata
                  icon={Phone}
                  label="No. HP"
                  value={profile?.phone || 'Belum diisi'}
                />
                <Biodata
                  icon={CalendarDays}
                  label="Bergabung sejak"
                  value={profile ? formatDate(profile.createdAt) : '—'}
                />
              </dl>
            </div>
          </div>

          {showProfileForm ? (
            <form
              id="profil-form"
              onSubmit={(event) => {
                event.preventDefault()
                void profileForm.handleSubmit()
              }}
              className="border-t border-border/70 bg-surface/30 p-5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <profileForm.Field
                  name="name"
                  validators={{
                    onSubmit: ({ value }) =>
                      value.trim().length >= 2
                        ? undefined
                        : 'Nama minimal 2 karakter',
                  }}
                  children={(field) => {
                    const hasError = field.state.meta.errors.length > 0
                    return (
                      <div className="grid gap-2">
                        <Label htmlFor={`profil-${field.name}`}>
                          Nama lengkap
                        </Label>
                        <Input
                          id={`profil-${field.name}`}
                          className="h-9 bg-background"
                          autoComplete="name"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={hasError || undefined}
                        />
                        {hasError ? (
                          <p role="alert" className="text-xs text-sale">
                            {field.state.meta.errors.map(String).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    )
                  }}
                />
                <profileForm.Field
                  name="phone"
                  validators={{
                    onSubmit: ({ value }) =>
                      value.trim() === '' || /^0\d{8,12}$/.test(value.trim())
                        ? undefined
                        : 'Nomor HP tidak valid',
                  }}
                  children={(field) => {
                    const hasError = field.state.meta.errors.length > 0
                    return (
                      <div className="grid gap-2">
                        <Label htmlFor={`profil-${field.name}`}>No. HP</Label>
                        <Input
                          id={`profil-${field.name}`}
                          className="h-9 bg-background"
                          autoComplete="tel"
                          inputMode="tel"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="081234567890"
                          aria-invalid={hasError || undefined}
                        />
                        {hasError ? (
                          <p role="alert" className="text-xs text-sale">
                            {field.state.meta.errors.map(String).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    )
                  }}
                />
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="profil-email">Email</Label>
                  <Input
                    id="profil-email"
                    className="h-9 bg-background"
                    value={profileEmail}
                    readOnly
                    disabled
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Email dipakai untuk masuk dan tidak bisa diubah dari halaman
                    ini.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-[11px] text-muted-foreground">
                  Klik ikon kamera pada foto untuk menggantinya.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-full px-4 text-xs"
                    onClick={cancelProfileEdit}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 rounded-full px-4 text-xs"
                    disabled={profileMutation.isPending || avatarBusy}
                  >
                    {profileMutation.isPending ? 'Menyimpan…' : 'Simpan profil'}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </AccountSection>

      <AccountSection
        title="Pesanan terbaru"
        description="Tiga transaksi terakhir kamu."
        action={
          <Link
            to="/akun/pesanan"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Lihat semua
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      >
        {recentOrders.length > 0 ? (
          <div className={cn(accountCard, 'overflow-hidden')}>
            <div className="divide-y divide-border/60">
              {recentOrders.map((order) => {
                const tone = orderStatusTone(order.status)
                return (
                  <Link
                    key={order.id}
                    to="/akun/pesanan"
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition duration-200 hover:bg-surface/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs font-semibold tracking-tight">
                          {order.code}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            statusToneBadge[tone],
                            'h-5 rounded-full px-2 text-[10px] font-medium',
                          )}
                        >
                          {ORDER_STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {ORDER_TYPE_LABEL[order.type] ?? order.type} ·{' '}
                        {order.itemCount} item · {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {rupiah(order.grandTotal)}
                    </p>
                    <ArrowUpRight
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <AccountEmptyState
            icon={Receipt}
            title="Belum ada pesanan"
            description="Gear pertamamu menunggu di katalog — pesanan yang kamu buat akan muncul di sini."
            action={
              <Button asChild className="rounded-full">
                <Link to="/katalog">Jelajahi katalog</Link>
              </Button>
            }
          />
        )}
      </AccountSection>

      <AccountSection
        title="Alamat"
        description="Alamat pengiriman dan pengambilan."
        action={
          addresses?.length || showForm ? (
            <Button
              type="button"
              size="sm"
              variant={showForm ? 'ghost' : 'outline'}
              className="h-8 rounded-full px-3 text-xs"
              aria-expanded={showForm}
              aria-controls="alamat-form"
              onClick={() => setShowForm((value) => !value)}
            >
              {showForm ? (
                'Tutup'
              ) : (
                <>
                  <Plus className="size-3.5" aria-hidden="true" />
                  Tambah alamat
                </>
              )}
            </Button>
          ) : undefined
        }
      >
        {addresses?.length ? (
          <div className={cn(accountCard, 'overflow-hidden')}>
            <div className="divide-y divide-border/60">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div className="min-w-0 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{address.recipient}</p>
                      {address.label ? (
                        <span className="text-xs text-muted-foreground">
                          {address.label}
                        </span>
                      ) : null}
                      {address.isDefault ? (
                        <Badge
                          variant="secondary"
                          className="h-5 rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary"
                        >
                          Utama
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      {address.street}, {address.city}, {address.province}{' '}
                      {address.postalCode}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {address.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus alamat ${address.recipient}`}
                    className="size-8 shrink-0 text-muted-foreground hover:bg-sale/10 hover:text-sale"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(address.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : !showForm ? (
          <AccountEmptyState
            icon={MapPin}
            title="Belum ada alamat tersimpan"
            description="Tambahkan alamat agar checkout pengiriman lebih cepat."
            action={
              <Button
                type="button"
                className="rounded-full"
                onClick={() => setShowForm(true)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah alamat
              </Button>
            }
          />
        ) : null}

        {showForm ? (
          <form
            id="alamat-form"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
            className="rounded-2xl border border-border/60 bg-surface/30 p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Alamat baru</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Lengkapi detail alamat pengiriman.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setShowForm(false)
                  form.reset(emptyAddress)
                }}
              >
                Batal
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form.Field
                name="label"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Label (opsional)</Label>
                    <Input
                      id={field.name}
                      className="h-9 bg-background"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Rumah, Kantor…"
                    />
                  </div>
                )}
              />
              <form.Field
                name="recipient"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim().length >= 2
                      ? undefined
                      : 'Nama penerima wajib',
                }}
                children={(field) => {
                  const hasError = field.state.meta.errors.length > 0
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Nama penerima</Label>
                      <Input
                        id={field.name}
                        className="h-9 bg-background"
                        autoComplete="name"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={hasError || undefined}
                      />
                      {hasError ? (
                        <p role="alert" className="text-xs text-sale">
                          {field.state.meta.errors.map(String).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <form.Field
                name="phone"
                validators={{
                  onSubmit: ({ value }) =>
                    /^0\d{8,12}$/.test(value.trim())
                      ? undefined
                      : 'Nomor HP tidak valid',
                }}
                children={(field) => {
                  const hasError = field.state.meta.errors.length > 0
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>No. HP</Label>
                      <Input
                        id={field.name}
                        className="h-9 bg-background"
                        autoComplete="tel"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="081234567890"
                        aria-invalid={hasError || undefined}
                      />
                      {hasError ? (
                        <p role="alert" className="text-xs text-sale">
                          {field.state.meta.errors.map(String).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <form.Field
                name="postalCode"
                validators={{
                  onSubmit: ({ value }) =>
                    /^\d{5}$/.test(value.trim())
                      ? undefined
                      : 'Kode pos 5 digit',
                }}
                children={(field) => {
                  const hasError = field.state.meta.errors.length > 0
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Kode pos</Label>
                      <Input
                        id={field.name}
                        className="h-9 bg-background"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={hasError || undefined}
                      />
                      {hasError ? (
                        <p role="alert" className="text-xs text-sale">
                          {field.state.meta.errors.map(String).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <form.Field
                name="street"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim().length >= 5
                      ? undefined
                      : 'Alamat jalan terlalu pendek',
                }}
                children={(field) => {
                  const hasError = field.state.meta.errors.length > 0
                  return (
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor={field.name}>Alamat jalan</Label>
                      <Input
                        id={field.name}
                        className="h-9 bg-background"
                        autoComplete="street-address"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="Jl. Melati No. 1, RT 02/RW 05"
                        aria-invalid={hasError || undefined}
                      />
                      {hasError ? (
                        <p role="alert" className="text-xs text-sale">
                          {field.state.meta.errors.map(String).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <form.Field
                name="city"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim() ? undefined : 'Kota wajib diisi',
                }}
                children={(field) => {
                  const hasError = field.state.meta.errors.length > 0
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Kota</Label>
                      <Input
                        id={field.name}
                        className="h-9 bg-background"
                        autoComplete="address-level2"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={hasError || undefined}
                      />
                      {hasError ? (
                        <p role="alert" className="text-xs text-sale">
                          {field.state.meta.errors.map(String).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <form.Field
                name="province"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim() ? undefined : 'Provinsi wajib diisi',
                }}
                children={(field) => {
                  const hasError = field.state.meta.errors.length > 0
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Provinsi</Label>
                      <Input
                        id={field.name}
                        className="h-9 bg-background"
                        autoComplete="address-level1"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={hasError || undefined}
                      />
                      {hasError ? (
                        <p role="alert" className="text-xs text-sale">
                          {field.state.meta.errors.map(String).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )
                }}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <form.Field
                name="isDefault"
                children={(field) => (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                    Jadikan alamat utama
                  </label>
                )}
              />
              <Button
                type="submit"
                className="h-9 rounded-full px-4 text-xs"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Menyimpan…' : 'Simpan alamat'}
              </Button>
            </div>
          </form>
        ) : null}
      </AccountSection>
    </div>
  )
}

function Biodata({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 truncate font-medium">{value}</dd>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  className,
}: {
  icon: LucideIcon
  label: string
  value: string
  note: string
  className?: string
}) {
  return (
    <div className={cn('bg-card p-4 sm:p-5', className)}>
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-foreground/70">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {note}
      </p>
    </div>
  )
}
