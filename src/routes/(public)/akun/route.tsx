import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Heart, Home, LogOut, Receipt, Settings2 } from 'lucide-react'
import { logout, meOptions } from '#/server/fn/auth'
import { Button } from '#/components/ui/button'

const nav = [
  { label: 'Ringkasan', to: '/akun' as const, icon: Home },
  { label: 'Favorit', to: '/akun/favorit' as const, icon: Heart },
  { label: 'Riwayat Pesanan', to: '/akun/pesanan' as const, icon: Receipt },
  { label: 'Preferensi', to: '/akun/preferensi' as const, icon: Settings2 },
]

export const Route = createFileRoute('/(public)/akun')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (!user) {
      throw redirect({ to: '/masuk', search: { redirect: location.href } })
    }
    return { user }
  },
  component: AkunLayout,
})

function AkunLayout() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const signOut = useServerFn(logout)
  const logoutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meOptions.queryKey })
      toast.success('Kamu sudah keluar.')
      await queryClient.invalidateQueries()
    },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-36 md:px-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="md:w-64 md:shrink-0">
          <div className="rounded-[24px] border border-border/70 bg-card p-4">
            <p className="px-2 text-lg font-semibold tracking-tight">{user.name}</p>
            <p className="mb-3 truncate px-2 text-xs text-muted-foreground">{user.email}</p>
            <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Menu akun">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === '/akun' }}
                  className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition hover:bg-surface data-[active]:bg-primary data-[active]:text-primary-foreground"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
              <Button
                variant="ghost"
                className="justify-start gap-2 rounded-full px-4 py-2 text-sm font-medium text-sale hover:bg-sale/10 hover:text-sale md:mt-2"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="size-4" />
                Keluar
              </Button>
            </nav>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
