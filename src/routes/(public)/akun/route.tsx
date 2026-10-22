import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const { user: contextUser } = Route.useRouteContext()
  const { data: me } = useQuery(meOptions)
  const user = me ?? contextUser
  const initial = user.name.trim().slice(0, 1).toUpperCase() || '?'
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
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 md:px-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="md:w-60 md:shrink-0">
          <div className="md:sticky md:top-28">
            <div className="rounded-2xl border border-border/70 bg-card p-3">
              <div className="flex items-center gap-2.5 border-b border-border/70 px-2 pb-3 pt-1">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight">
                    {user.name}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <nav
                className="mt-2 grid grid-cols-2 gap-1 md:flex md:flex-col"
                aria-label="Menu akun"
              >
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === '/akun' }}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
                <Button
                  variant="ghost"
                  className="col-span-2 h-auto justify-start gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-sale hover:bg-sale/10 hover:text-sale md:col-span-1 md:mt-1"
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="size-4" />
                  Keluar
                </Button>
              </nav>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
