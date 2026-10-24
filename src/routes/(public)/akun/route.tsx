import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Heart,
  Home,
  LifeBuoy,
  LogOut,
  Mail,
  Receipt,
  Settings2,
} from 'lucide-react'
import { useLogout } from '#/lib/use-logout'
import { meOptions } from '#/server/fn/auth'
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
  // `undefined` = query belum selesai, pakai user dari loader. `null` = sudah
  // logout, jangan fallback ke context lama (itu yang bikin nama user tetap
  // tampil setelah Keluar).
  const user = me === undefined ? contextUser : me
  const logoutMutation = useLogout()

  if (!user) return null

  const initial = user.name.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <div className="relative min-h-svh">
      {/* Kanvas abu lembut — membentang dari tepi atas sampai tepi bawah
          viewport supaya tidak ada pita putih di belakang navbar tetap. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-surface/50"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-32 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          <aside className="md:w-64 md:shrink-0">
            <div className="flex flex-col gap-3 md:sticky md:top-28">
              <div className="rounded-2xl border border-border/60 bg-card p-2.5 shadow-sm">
                <div className="flex items-center gap-3 px-1.5 pb-3 pt-1.5">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
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
                  className="grid grid-cols-2 gap-1 border-t border-border/60 pt-2.5 md:flex md:flex-col"
                  aria-label="Menu akun"
                >
                  {nav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === '/akun' }}
                      className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:bg-surface hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ))}
                  <Button
                    variant="ghost"
                    className="col-span-2 h-auto justify-start gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-sale transition-colors duration-200 hover:bg-sale/10 hover:text-sale md:col-span-1 md:mt-0.5"
                    disabled={logoutMutation.isPending}
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="size-4" />
                    Keluar
                  </Button>
                </nav>
              </div>

              <div className="hidden rounded-2xl border border-border/60 bg-surface/60 p-4 md:block">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <LifeBuoy className="size-3.5" aria-hidden="true" />
                  Butuh bantuan?
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Tim kami siap membantu untuk pertanyaan seputar pesanan, sewa,
                  dan pengiriman.
                </p>
                <a
                  href="mailto:halo@tibatibacamping.test"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium underline-offset-4 hover:underline"
                >
                  <Mail className="size-3" aria-hidden="true" />
                  halo@tibatibacamping.test
                </a>
              </div>
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
