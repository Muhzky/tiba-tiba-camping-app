import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { logout, meOptions } from '#/server/fn/auth'

const MENU = [
  { to: '/admin', label: 'Overview', icon: 'fas fa-chart-line', exact: true },
  { to: '/admin/produk', exact: false, label: 'Produk', icon: 'fas fa-box-open' },
  { to: '/admin/transaksi', exact: false, label: 'Transaksi', icon: 'fas fa-file-invoice-dollar' },
  { to: '/admin/pos', exact: false, label: 'POS Kasir', icon: 'fas fa-cash-register' },
  { to: '/admin/pengguna', exact: false, label: 'Pengguna', icon: 'fas fa-users' },
  { to: '/admin/atribut', exact: false, label: 'Atribut & Kamus', icon: 'fas fa-tags' },
  { to: '/admin/rekomendasi', exact: false, label: 'Rekomendasi', icon: 'fas fa-brain' },
] as const

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [{ title: 'Admin — Tiba Tiba Camping' }],
    links: [
      { rel: 'stylesheet', href: '/stisla/css/bootstrap.min.css' },
      { rel: 'stylesheet', href: '/stisla/css/style.css' },
      { rel: 'stylesheet', href: '/stisla/css/components.css' },
      { rel: 'stylesheet', href: '/stisla/css/all.min.css' },
      { rel: 'stylesheet', href: '/stisla/css/custom.css' },
    ],
  }),
  loader: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (!user) throw redirect({ to: '/masuk' })
    if (user.role === 'customer') throw redirect({ to: '/akun' })
    return user
  },
  component: AdminLayout,
})

function AdminLayout() {
  const user = Route.useLoaderData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const router = useRouter()
  const queryClient = useQueryClient()
  const signOut = useServerFn(logout)
  const signOutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meOptions.queryKey })
      await router.navigate({ to: '/' })
    },
  })

  useEffect(() => {
    const sync = () => document.body.classList.toggle('sidebar-gone', window.innerWidth < 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    if (window.innerWidth < 768) document.body.classList.add('sidebar-gone')
  }, [pathname])

  const toggleSidebar = () => document.body.classList.toggle('sidebar-gone')

  return (
    <div className="main-wrapper main-wrapper-1">
      <div className="navbar-bg" />
      <nav className="navbar navbar-expand-lg main-navbar">
        <ul className="navbar-nav mr-3">
          <li>
            <a
              href="#sidebar"
              className="nav-link nav-link-lg"
              onClick={(e) => {
                e.preventDefault()
                toggleSidebar()
              }}
            >
              <i className="fas fa-bars" />
            </a>
          </li>
        </ul>
        <div className="form-inline mr-auto" />
        <div className="navbar-right">
          <ul className="navbar-nav">
            <li className="nav-item dropdown">
              <span className="nav-link nav-link-lg mr-2" title={user.email}>
                <i className="fas fa-user-circle mr-1" /> {user.name}
                <span className="badge badge-primary ml-1">{user.role}</span>
              </span>
            </li>
            <li>
              <Link to="/" className="nav-link nav-link-lg" title="Lihat situs">
                <i className="fas fa-globe" />
              </Link>
            </li>
            <li>
              <a
                href="#keluar"
                className="nav-link nav-link-lg"
                title="Keluar"
                onClick={(e) => {
                  e.preventDefault()
                  signOutMutation.mutate()
                }}
              >
                <i className="fas fa-sign-out-alt" />
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <div className="main-sidebar sidebar-style-2">
        <aside id="sidebar-wrapper">
          <div className="sidebar-brand">
            <Link to="/admin">Tiba Tiba</Link>
          </div>
          <div className="sidebar-brand-sm">TT</div>
          <ul className="sidebar-menu">
            <li className="menu-header">Operasional</li>
            {MENU.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
              return (
                <li key={item.to} className={active ? 'active' : undefined}>
                  <Link to={item.to} className="nav-link">
                    <i className={item.icon} /> <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </aside>
      </div>

      <div className="admin-sidebar-backdrop" onClick={toggleSidebar} aria-hidden="true" />

      <div className="main-content">
        <section className="section">
          <Outlet />
        </section>
      </div>

      <footer className="main-footer">
        <div className="d-flex justify-content-between">
          <span>© 2026 Tiba Tiba Camping — Admin POS</span>
        </div>
      </footer>
    </div>
  )
}
