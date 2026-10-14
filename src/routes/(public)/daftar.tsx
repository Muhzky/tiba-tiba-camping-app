import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { meOptions } from '#/server/fn/auth'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/(public)/daftar')({
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
      toast.success('Akun dibuat. Selamat datang di Tiba Tiba Camping!')
      await navigate({ to: '/akun' })
    },
  })

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-36">
      <div className="rounded-[28px] border border-border/70 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Daftar Akun</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sudah punya akun?{' '}
          <Link to="/masuk" className="font-medium text-primary underline-offset-4 hover:underline">
            Masuk di sini
          </Link>
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="mt-6 flex flex-col gap-4"
        >
          <form.Field
            name="name"
            validators={{ onSubmit: ({ value }) => (value.trim().length >= 2 ? undefined : 'Nama minimal 2 karakter') }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Nama lengkap</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Budi Santoso"
                  autoComplete="name"
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
            name="email"
            validators={{ onSubmit: ({ value }) => z.email('Masukkan email yang valid').safeParse(value).error?.issues[0]?.message }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  type="email"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
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
            name="password"
            validators={{ onSubmit: ({ value }) => (value.length >= 8 ? undefined : 'Password minimal 8 karakter') }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Password</Label>
                <Input
                  id={field.name}
                  type="password"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
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
            name="confirm"
            validators={{
              onSubmit: ({ value, fieldApi }) =>
                value === fieldApi.form.getFieldValue('password')
                  ? undefined
                  : 'Konfirmasi password tidak sama',
            }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Ulangi password</Label>
                <Input
                  id={field.name}
                  type="password"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {field.state.meta.errors.length > 0 ? (
                  <p role="alert" className="text-xs text-sale">
                    {field.state.meta.errors.map(String).join(', ')}
                  </p>
                ) : null}
              </div>
            )}
          />

          {serverError ? (
            <p role="alert" className="rounded-lg bg-sale/10 px-3 py-2 text-sm text-sale">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" className="mt-1 h-11 rounded-full font-semibold" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? 'Membuat akun…' : 'Daftar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
