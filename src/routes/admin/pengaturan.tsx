import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Camera,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Save,
  Share2,
  Trash2,
} from 'lucide-react'
import {
  siteSettingsOptions,
  updateAdminProfile,
  updateSiteSettings,
} from '#/server/fn/settings'
import type { SiteSettings, SiteSettingsInput } from '#/server/fn/settings'
import { meOptions } from '#/server/fn/auth'
import type { SessionUser } from '#/server/fn/auth'
import { ALLOWED_IMAGE_TYPES, getAvatarUploadUrl } from '#/server/fn/storage'
import { avatarFileError, uploadProfileImage } from '#/lib/avatar'
import { queryKeys } from '#/lib/query-keys'
import { formatDateTime } from '#/lib/format'
import { cn } from '#/lib/utils'
import {
  openingHoursLine,
  openingHoursWithZone,
  socialLinks,
} from '#/lib/site-settings'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminAvatar } from '#/components/admin/avatar'
import { Field } from '#/components/admin/field'
import { AdminButton } from '#/components/admin/button'

export const Route = createFileRoute('/admin/pengaturan')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsOptions),
      context.queryClient.ensureQueryData(meOptions),
    ])
  },
  component: PengaturanPage,
})

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (raw.includes('EMAIL_SUDAH_DIPAKAI'))
    return 'Email itu sudah dipakai akun lain.'
  if (raw.includes('AKSES_DITOLAK'))
    return 'Akses ditolak. Silakan masuk ulang sebagai admin.'
  if (raw.includes('URL foto tidak valid'))
    return 'URL foto tidak valid. Coba unggah ulang fotonya.'
  return raw || 'Gagal menyimpan. Coba lagi.'
}

const ACCEPTED_IMAGE_TYPES = ALLOWED_IMAGE_TYPES.join(',')

function PengaturanPage() {
  const { data: settings } = useSuspenseQuery(siteSettingsOptions)
  const { data: me } = useQuery(meOptions)

  return (
    <AdminPage
      title="Pengaturan"
      description="Profil admin, kontak toko, jam buka, dan isi footer yang tampil di situs publik."
      breadcrumb={[{ label: 'Admin', to: '/admin' }, { label: 'Pengaturan' }]}
    >
      {me ? <ProfileCard user={me} /> : null}
      <SettingsForm
        key={String(settings.updatedAt ?? 'default')}
        settings={settings}
      />
    </AdminPage>
  )
}

function ProfileCard({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const saveProfile = useServerFn(updateAdminProfile)
  const uploadAvatar = useServerFn(getAvatarUploadUrl)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone ?? '')
  // `null` = tanpa foto. Berubah lokal dulu, ikut tersimpan saat "Simpan profil"
  // supaya foto & data diri diperbarui dalam satu langkah.
  const [image, setImage] = useState<string | null>(user.image)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const mutation = useMutation({
    mutationFn: () => saveProfile({ data: { name, email, phone, image } }),
    onSuccess: async (saved) => {
      queryClient.setQueryData<SessionUser | null>(
        queryKeys.me(),
        (previous) =>
          previous
            ? {
                ...previous,
                name: saved.name,
                email: saved.email,
                phone: saved.phone,
                image: saved.image,
              }
            : previous,
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      await router.invalidate()
      toast.success('Profil admin disimpan.')
    },
    onError: (error) => toast.error(errorText(error)),
  })

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return
    const rejected = avatarFileError(file)
    if (rejected) {
      toast.error(rejected)
      return
    }
    setAvatarBusy(true)
    try {
      setImage(await uploadProfileImage(file, uploadAvatar))
      toast.success('Foto siap — klik “Simpan profil” untuk menyimpannya.')
    } catch {
      toast.error('Gagal mengunggah foto. Coba lagi.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const initial = name.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <AdminCard
      title="Profil admin"
      actions={
        <span className="text-xs text-muted-foreground">Admin</span>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="relative shrink-0">
            <label className="block cursor-pointer" title="Ganti foto profil">
              <AdminAvatar
                src={image}
                alt={`Foto profil ${name || user.name}`}
                fallback={initial}
                className="avatar--xl avatar--circle"
              />
              <span
                className={cn(
                  'absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm',
                  avatarBusy && 'pointer-events-none opacity-60',
                )}
              >
                <Camera className="size-3.5" aria-hidden="true" />
              </span>
              <input
                type="file"
                className="sr-only"
                accept={ACCEPTED_IMAGE_TYPES}
                disabled={avatarBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // Kosongkan supaya file yang sama bisa dipilih lagi.
                  event.target.value = ''
                  void handleAvatarFile(file)
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {name || user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {email || user.email}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>JPG, PNG, atau WebP · maks 5 MB</span>
              {image ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                  onClick={() => setImage(null)}
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  Hapus foto
                </button>
              ) : (
                <span>Foto disimpan bersama data profil di bawah.</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nama lengkap" htmlFor="admin-name" required>
            <input
              id="admin-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Email admin" htmlFor="admin-email" required>
            <input
              id="admin-email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={160}
              required
            />
          </Field>
          <Field
            label="Nomor HP"
            htmlFor="admin-phone"
            description="Dipakai untuk kebutuhan internal; kontak publik diatur di bawah."
          >
            <input
              id="admin-phone"
              type="tel"
              className="input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              maxLength={30}
              placeholder="0812xxxxxxx"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <AdminButton
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
          >
            <Save aria-hidden="true" />
            {mutation.isPending ? 'Menyimpan…' : 'Simpan profil'}
          </AdminButton>
        </div>
      </form>
    </AdminCard>
  )
}

function SettingsForm({ settings }: { settings: SiteSettings }) {
  const queryClient = useQueryClient()
  const saveSettings = useServerFn(updateSiteSettings)
  const [form, setForm] = useState<SiteSettingsInput>({
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    address: settings.address,
    openingDays: settings.openingDays,
    openingHours: settings.openingHours,
    timezone: settings.timezone,
    footerDescription: settings.footerDescription,
    instagramUrl: settings.instagramUrl,
    youtubeUrl: settings.youtubeUrl,
    facebookUrl: settings.facebookUrl,
    tiktokUrl: settings.tiktokUrl,
  })

  const set = <TField extends keyof SiteSettingsInput>(
    key: TField,
    value: SiteSettingsInput[TField],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const mutation = useMutation({
    mutationFn: () => saveSettings({ data: form }),
    onSuccess: (saved) => {
      queryClient.setQueryData(siteSettingsOptions.queryKey, saved)
      toast.success('Pengaturan situs disimpan.')
    },
    onError: (error) => toast.error(errorText(error)),
  })

  const previewSocials = socialLinks(form)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
      className="grid gap-6 xl:grid-cols-2"
    >
      <div className="grid content-start gap-6">
        <AdminCard
          title="Kontak toko"
          actions={
            <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email publik" htmlFor="contact-email" required>
              <input
                id="contact-email"
                type="email"
                className="input"
                value={form.contactEmail}
                onChange={(event) => set('contactEmail', event.target.value)}
                maxLength={160}
                required
              />
            </Field>
            <Field label="Nomor HP / WhatsApp" htmlFor="contact-phone" required>
              <input
                id="contact-phone"
                type="tel"
                className="input"
                value={form.contactPhone}
                onChange={(event) => set('contactPhone', event.target.value)}
                maxLength={30}
                required
              />
            </Field>
            <Field
              label="Alamat toko"
              htmlFor="contact-address"
              required
              className="sm:col-span-2"
              description="Tampil di footer, halaman Tentang, dan catatan ambil di toko saat checkout."
            >
              <textarea
                id="contact-address"
                className="textarea"
                rows={2}
                value={form.address}
                onChange={(event) => set('address', event.target.value)}
                maxLength={300}
                required
              />
            </Field>
          </div>
        </AdminCard>

        <AdminCard
          title="Jam operasional"
          actions={
            <Clock3
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hari buka" htmlFor="opening-days" required>
              <input
                id="opening-days"
                className="input"
                value={form.openingDays}
                onChange={(event) => set('openingDays', event.target.value)}
                maxLength={80}
                placeholder="Senin–Sabtu"
                required
              />
            </Field>
            <Field label="Jam buka" htmlFor="opening-hours" required>
              <input
                id="opening-hours"
                className="input"
                value={form.openingHours}
                onChange={(event) => set('openingHours', event.target.value)}
                maxLength={80}
                placeholder="09.00–18.00"
                required
              />
            </Field>
            <Field
              label="Zona waktu"
              htmlFor="opening-timezone"
              required
              className="sm:col-span-2"
              description={`Tampil di landing page sebagai “${openingHoursWithZone(form)}”.`}
            >
              <input
                id="opening-timezone"
                className="input"
                value={form.timezone}
                onChange={(event) => set('timezone', event.target.value)}
                maxLength={80}
                placeholder="WIB (Asia/Jakarta)"
                required
              />
            </Field>
          </div>
        </AdminCard>
      </div>

      <div className="grid content-start gap-6">
        <AdminCard
          title="Footer & media sosial"
          actions={
            <Share2
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          }
        >
          <div className="grid gap-4">
            <Field
              label="Deskripsi footer"
              htmlFor="footer-description"
              description={`${form.footerDescription.length}/240 karakter. Tampil di bawah logo pada footer.`}
            >
              <textarea
                id="footer-description"
                className="textarea"
                rows={3}
                value={form.footerDescription}
                onChange={(event) =>
                  set('footerDescription', event.target.value)
                }
                maxLength={240}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Instagram" htmlFor="social-instagram">
                <input
                  id="social-instagram"
                  type="url"
                  className="input"
                  value={form.instagramUrl}
                  onChange={(event) => set('instagramUrl', event.target.value)}
                  placeholder="https://instagram.com/…"
                  maxLength={300}
                />
              </Field>
              <Field label="YouTube" htmlFor="social-youtube">
                <input
                  id="social-youtube"
                  type="url"
                  className="input"
                  value={form.youtubeUrl}
                  onChange={(event) => set('youtubeUrl', event.target.value)}
                  placeholder="https://youtube.com/@…"
                  maxLength={300}
                />
              </Field>
              <Field label="Facebook" htmlFor="social-facebook">
                <input
                  id="social-facebook"
                  type="url"
                  className="input"
                  value={form.facebookUrl}
                  onChange={(event) => set('facebookUrl', event.target.value)}
                  placeholder="https://facebook.com/…"
                  maxLength={300}
                />
              </Field>
              <Field label="TikTok" htmlFor="social-tiktok">
                <input
                  id="social-tiktok"
                  type="url"
                  className="input"
                  value={form.tiktokUrl}
                  onChange={(event) => set('tiktokUrl', event.target.value)}
                  placeholder="https://tiktok.com/@…"
                  maxLength={300}
                />
              </Field>
            </div>

            <p className="field__description">
              Kosongkan URL yang belum ada — ikonnya otomatis disembunyikan di
              footer.
            </p>
          </div>
        </AdminCard>

        <AdminCard title="Pratinjau kontak">
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              {form.footerDescription || '—'}
            </p>
            <ul className="grid gap-2">
              <li className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{form.address || '—'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{form.contactEmail || '—'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{form.contactPhone || '—'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock3
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>
                  {openingHoursLine(form)}
                  {form.timezone ? ` — ${form.timezone}` : ''}
                </span>
              </li>
            </ul>
            {previewSocials.length ? (
              <div className="flex flex-wrap gap-1.5">
                {previewSocials.map((social) => (
                  <span
                    key={social.key}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {social.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Belum ada media sosial yang aktif.
              </p>
            )}
          </div>
        </AdminCard>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between xl:col-span-2">
        <p className="text-xs text-muted-foreground">
          {settings.updatedAt
            ? `Terakhir diperbarui ${formatDateTime(settings.updatedAt)}`
            : 'Belum pernah disimpan — masih memakai nilai bawaan.'}
        </p>
        <AdminButton
          type="submit"
          variant="primary"
          disabled={mutation.isPending}
        >
          <Save aria-hidden="true" />
          {mutation.isPending ? 'Menyimpan…' : 'Simpan pengaturan'}
        </AdminButton>
      </div>
    </form>
  )
}
