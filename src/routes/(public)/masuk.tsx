import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertCircle, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { queryKeys } from '#/lib/query-keys'
import { isStaffRole, postLoginTarget } from '#/lib/roles'
import { toSessionUser } from '#/lib/session-user'
import {
  layoutStylesheetHref,
  warmLayoutStylesheet,
} from '#/lib/use-layout-stylesheet'
import { adminOverviewOptions } from '#/server/fn/admin'
import { meOptions } from '#/server/fn/auth'
import { AuthField, PasswordField } from '#/components/site/AuthField'
import { AuthShell } from '#/components/site/AuthShell'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/(public)/masuk')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  // CSS admin adalah compile unit terpisah dan, tanpa dipanaskan, baru diminta
  // setelah dashboard dirender — panel sempat tampil tanpa gaya.
  // `media="not all"`: file ikut diunduh & diparse selagi user mengisi form,
  // tapi aturannya tidak berlaku sampai rute /admin aktif.
  head: () => ({
    meta: [{ title: 'Masuk — Tiba Tiba Camping' }],
    links: [
      {
        rel: 'stylesheet',
        href: layoutStylesheetHref('admin'),
        media: 'not all',
        'data-layout-style': 'admin',
      },
    ],
  }),
  loader: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (user) throw redirect({ to: postLoginTarget(user.role) })
  },
  component: LoginPage,
})

function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const search = Route.useSearch()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const { data: signIn, error } = await authClient.signIn.email(value)
      if (error) {
        setServerError(error.message ?? 'Email atau password salah.')
        return
      }
      // Hasil "Paling cocok" dan rekomendasi kini memakai profil akun ini.
      // Jangan ditunggu: navigasi ke dashboard tidak boleh tertahan refetch katalog.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(),
      })
      // Respons sign-in sudah membawa user lengkap: tulis langsung ke cache supaya
      // guard rute admin dan Navbar tidak menunggu round trip getSessionUser.
      const freshUser = toSessionUser(signIn.user)
      if (freshUser) queryClient.setQueryData(meOptions.queryKey, freshUser)
      const me = freshUser ?? (await queryClient.fetchQuery(meOptions))
      // Arahkan admin/owner ke panel admin, customer ke akun (kecuali ada ?redirect=).
      const target = postLoginTarget(me?.role, search.redirect)
      // Staff: ambil ringkasan dashboard sekarang juga, berbarengan dengan
      // pengunduhan chunk admin. Loader overview akan memakai promise yang sama,
      // jadi skeleton hanya tampil selama chunk admin dimuat — tidak ditambah
      // round trip data setelahnya.
      if (isStaffRole(me?.role)) {
        void queryClient.prefetchQuery(adminOverviewOptions)
        // Biasanya sudah selesai sejak halaman login dibuka (link preload di
        // atas). Kalau belum, tahan navigasi sebentar di balik status
        // "Memproses…" daripada sempat menampilkan dashboard tanpa CSS.
        await warmLayoutStylesheet('admin')
      }
      // Mulai unduh chunk + data halaman tujuan selagi navigasi berjalan.
      if (target === '/admin' || target === '/akun') {
        void router.preloadRoute({ to: target }).catch(() => undefined)
      }
      toast.success('Selamat datang kembali!')
      await navigate({ to: target })
    },
  })

  return (
    <AuthShell
      title="Masuk"
      subtitle={
        <>
          Belum punya akun?{' '}
          <Link
            to="/daftar"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Daftar gratis
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <form.Field
          name="email"
          validators={{
            onSubmit: ({ value }) =>
              z.email('Masukkan email yang valid').safeParse(value).error
                ?.issues[0]?.message,
          }}
          children={(field) => {
            const errors = field.state.meta.errors.map(String)
            return (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Email</Label>
                <AuthField
                  icon={Mail}
                  id={field.name}
                  type="email"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
                  aria-invalid={errors.length > 0 ? true : undefined}
                />
                {errors.length > 0 ? (
                  <p role="alert" className="text-xs text-sale">
                    {errors.join(', ')}
                  </p>
                ) : null}
              </div>
            )
          }}
        />

        <form.Field
          name="password"
          validators={{
            onSubmit: ({ value }) =>
              value.length >= 8 ? undefined : 'Password minimal 8 karakter',
          }}
          children={(field) => {
            const errors = field.state.meta.errors.map(String)
            return (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Password</Label>
                <PasswordField
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={errors.length > 0 ? true : undefined}
                />
                {errors.length > 0 ? (
                  <p role="alert" className="text-xs text-sale">
                    {errors.join(', ')}
                  </p>
                ) : null}
              </div>
            )
          }}
        />

        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-sale/10 px-4 py-3 text-sm text-sale"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>{serverError}</p>
          </div>
        ) : null}

        <Button
          type="submit"
          className="mt-1 h-11 w-full rounded-full text-sm font-semibold"
          disabled={form.state.isSubmitting}
        >
          {form.state.isSubmitting ? 'Memproses…' : <>Masuk</>}
        </Button>
      </form>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-3 text-center text-xs text-muted-foreground">
        Akun demo:{' '}
        <span className="font-medium text-foreground">
          budi@tibatibacamping.test
        </span>{' '}
        / <span className="font-medium text-foreground">password123</span>
      </div>
    </AuthShell>
  )
}
