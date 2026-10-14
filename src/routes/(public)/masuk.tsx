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

export const Route = createFileRoute('/(public)/masuk')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  loader: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (user) throw redirect({ to: '/akun' })
  },
  component: LoginPage,
})

function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const { error } = await authClient.signIn.email(value)
      if (error) {
        setServerError(error.message ?? 'Email atau password salah.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: meOptions.queryKey })
      toast.success('Selamat datang kembali!')
      await navigate({ to: search.redirect ?? '/akun' })
    },
  })

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-36">
      <div className="rounded-[28px] border border-border/70 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Masuk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Belum punya akun?{' '}
          <Link to="/daftar" className="font-medium text-primary underline-offset-4 hover:underline">
            Daftar di sini
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
                  placeholder="••••••••"
                  autoComplete="current-password"
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
            {form.state.isSubmitting ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Akun demo: budi@tibatibacamping.test / password123
        </p>
      </div>
    </div>
  )
}
