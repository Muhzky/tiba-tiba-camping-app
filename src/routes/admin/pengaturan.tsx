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
import { Clock3, Mail, MapPin, Phone, Save, Share2 } from 'lucide-react'
import {
  siteSettingsOptions,
  updateAdminProfile,
  updateSiteSettings,
} from '#/server/fn/settings'
import type { SiteSettings, SiteSettingsInput } from '#/server/fn/settings'
import { meOptions } from '#/server/fn/auth'
import type { SessionUser } from '#/server/fn/auth'
import { queryKeys } from '#/lib/query-keys'
import { formatDateTime } from '#/lib/format'
import {
  openingHoursLine,
  openingHoursWithZone,
  socialLinks,
} from '#/lib/site-settings'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
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
  return raw || 'Gagal menyimpan. Coba lagi.'
}

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
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone ?? '')

  const mutation = useMutation({
    mutationFn: () => saveProfile({ data: { name, email, phone } }),
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
              }
            : previous,
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      await router.invalidate()
      toast.success('Profil admin disimpan.')
    },
    onError: (error) => toast.error(errorText(error)),
  })

  const initial = user.name.trim().slice(0, 1).toUpperCase() || '?'

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
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
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
