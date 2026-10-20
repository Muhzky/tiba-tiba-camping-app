import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertCircle, ArrowRight, Mail, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { queryKeys } from '#/lib/query-keys'
import { meOptions } from '#/server/fn/auth'
import { AuthField, PasswordField } from '#/components/site/AuthField'
import { AuthShell } from '#/components/site/AuthShell'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/(public)/daftar')({
  head: () => ({ meta: [{ title: 'Daftar — Tiba Tiba Camping' }] }),
  loader: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (user) throw redirect({ to: '/akun' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirm: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const { error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
      })
      if (error) {
        setServerError(error.message ?? 'Pendaftaran gagal. Coba lagi.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: meOptions.queryKey })
      // Rekomendasi katalog kini memakai profil akun baru.
      await queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      toast.success('Akun dibuat. Selamat datang di Tiba Tiba Camping!')
      await navigate({ to: '/akun' })
    },
  })

  return (
    <AuthShell
      title="Daftar Akun"
      subtitle={
        <>
          Sudah punya akun?{' '}
          <Link
            to="/masuk"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Masuk di sini
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
          name="name"
          validators={{
            onSubmit: ({ value }) =>
              value.trim().length >= 2 ? undefined : 'Nama minimal 2 karakter',
          }}
          children={(field) => {
            const errors = field.state.meta.errors.map(String)
            return (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Nama lengkap</Label>
                <AuthField
                  icon={UserRound}
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Budi Santoso"
                  autoComplete="name"
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
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  aria-invalid={errors.length > 0 ? true : undefined}
                />
                {errors.length > 0 ? (
                  <p role="alert" className="text-xs text-sale">
                    {errors.join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Minimal 8 karakter.
                  </p>
                )}
              </div>
            )
          }}
        />

        <form.Field
          name="confirm"
          validators={{
            onSubmit: ({ value, fieldApi }) =>
              value === fieldApi.form.getFieldValue('password')
                ? undefined
                : 'Konfirmasi password tidak sama',
          }}
          children={(field) => {
            const errors = field.state.meta.errors.map(String)
            return (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Ulangi password</Label>
                <PasswordField
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
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
          {form.state.isSubmitting ? (
            'Membuat akun…'
          ) : (
            <>
              Daftar
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        Dengan mendaftar, kamu setuju gear yang dibeli, disewa, atau
        di-pre-order mengikuti ketentuan garansi resmi ALLTREK.
      </p>
    </AuthShell>
  )
}
