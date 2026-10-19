import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  Banknote,
  Brain,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Package,
  ReceiptText,
  Tags,
  Tent,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import adminCss from '../../styles/admin.css?url'
import { logout, meOptions } from '#/server/fn/auth'
import { buttonClass } from '#/components/admin/button'
import { StatusBadge } from '#/components/admin/badge'
import { cn } from '#/lib/utils'

type MenuGroup = {
  title: string
  items: Array<{ to: string; label: string; icon: LucideIcon; exact?: boolean }>
}

const MENU: MenuGroup[] = [
  {
    title: 'Operasional',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
      { to: '/admin/produk', label: 'Produk', icon: Package },
      { to: '/admin/transaksi', label: 'Transaksi', icon: ReceiptText },
      { to: '/admin/pos', label: 'POS Kasir', icon: Banknote },
      { to: '/admin/pengguna', label: 'Pengguna', icon: Users },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { to: '/admin/atribut', label: 'Atribut & Kamus', icon: Tags },
      { to: '/admin/rekomendasi', label: 'Rekomendasi', icon: Brain },
    ],
  },
]

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [{ title: 'Admin — Tiba Tiba Camping' }],
    links: [{ rel: 'stylesheet', href: adminCss }],
  }),
  loader: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (!user) throw redirect({ to: '/masuk' })
    if (user.role === 'customer') throw redirect({ to: '/akun' })
    return user
  },
  component: AdminLayout,
})

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.charAt(0) ?? ''
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + second).toUpperCase()
}

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

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  // Tutup drawer mobile saat pindah halaman.
  useEffect(() => {
    setSidebarVisible(false)
  }, [pathname])

  // Escape menutup drawer & menu user; klik di luar menutup menu user.
  useEffect(() => {
    if (!sidebarVisible && !userMenuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSidebarVisible(false)
      setUserMenuOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [sidebarVisible, userMenuOpen])

  // Lewati breakpoint desktop → tutup drawer (sidebar kembali statis).
  useEffect(() => {
    const media = window.matchMedia('(min-width: 64rem)')
    const onChange = () => {
      if (media.matches) setSidebarVisible(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return (
    <>
      <div
        className={cn('admin-shell', sidebarVisible && 'is-sidebar-visible')}
        onClick={(event) => {
          if (event.target === event.currentTarget && sidebarVisible) setSidebarVisible(false)
        }}
      >
        <aside id="admin-sidebar" className="sidebar sidebar--lg admin-sidebar">
          <header className="sidebar__header">
            <Link to="/admin" className="sidebar__brand">
              <Tent aria-hidden="true" />
              <span>Tiba Tiba</span>
            </Link>
          </header>

          <div className="sidebar__content">
            <nav className="sidebar__menu" aria-label="Menu admin">
              {MENU.map((group) => (
                <div key={group.title} className="sidebar__group">
                  <span className="sidebar__group-title">{group.title}</span>
                  <ul className="sidebar__list">
                    {group.items.map((item) => {
                      const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
                      const Icon = item.icon
                      return (
                        <li key={item.to} className="sidebar__item">
                          <Link
                            to={item.to}
                            className="sidebar__button"
                            activeOptions={{ exact: item.exact }}
                            aria-current={active ? 'page' : undefined}
                          >
                            <Icon aria-hidden="true" />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <footer className="sidebar__footer">
            <ul className="sidebar__list">
              <li className="sidebar__item">
                <Link to="/" className="sidebar__button">
                  <Globe aria-hidden="true" />
                  <span>Lihat situs</span>
                </Link>
              </li>
              <li className="sidebar__item">
                <button
                  type="button"
                  className="sidebar__button"
                  disabled={signOutMutation.isPending}
                  onClick={() => signOutMutation.mutate()}
                >
                  <LogOut aria-hidden="true" />
                  <span>{signOutMutation.isPending ? 'Keluar…' : 'Keluar'}</span>
                </button>
              </li>
            </ul>
            <div className="copyright py-3">
              <p className="text-xs" style={{ color: 'var(--sidebar-group-title-color)' }}>
                © 2026 Tiba Tiba Camping
              </p>
            </div>
          </footer>
        </aside>

        <div className="admin-main">
          <header className="navbar">
            <button
              type="button"
              className={buttonClass({ variant: 'ghost', iconOnly: true, className: 'lg:hidden' })}
              aria-label="Buka menu sidebar"
              aria-controls="admin-sidebar"
              aria-expanded={sidebarVisible}
              onClick={() => setSidebarVisible((visible) => !visible)}
            >
              <MenuIcon aria-hidden="true" />
            </button>

            <Link to="/admin" className="font-semibold lg:hidden">
              Tiba Tiba
            </Link>

            <div className="ms-auto flex items-center gap-1">
              <Link to="/" className={buttonClass({ variant: 'ghost', className: 'hidden sm:inline-flex' })}>
                <Globe aria-hidden="true" />
                <span className="hidden md:inline">Lihat situs</span>
              </Link>

              <div className="menu" ref={userMenuRef}>
                <button
                  type="button"
                  className={buttonClass({ variant: 'ghost', className: 'flex items-center gap-2' })}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((open) => !open)}
                >
                  <span className="hidden font-medium sm:inline">{user.name}</span>
                  <span className="avatar avatar--sm avatar--circle">
                    <span className="avatar__fallback">{initialsOf(user.name)}</span>
                  </span>
                  <ChevronDown aria-hidden="true" />
                </button>
                <div
                  className="menu__popup absolute top-full right-0 left-auto mt-1 w-56"
                  data-state={userMenuOpen ? 'open' : 'closed'}
                  role="menu"
                >
                  <div className="menu__group" role="none">
                    <h3 className="menu__group-label">{user.name}</h3>
                    <p className="px-3 pb-1 text-xs text-muted-foreground">{user.email}</p>
                    <div className="px-3 pb-1">
                      <StatusBadge tone={user.role === 'owner' ? 'primary' : 'neutral'} soft={false}>
                        {user.role}
                      </StatusBadge>
                    </div>
                  </div>
                  <hr className="menu__separator" role="separator" />
                  <Link to="/" className="menu__item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <Globe aria-hidden="true" />
                    Lihat situs
                  </Link>
                  <hr className="menu__separator" role="separator" />
                  <button
                    type="button"
                    className="menu__item menu__item--danger w-full"
                    role="menuitem"
                    disabled={signOutMutation.isPending}
                    onClick={() => signOutMutation.mutate()}
                  >
                    <LogOut aria-hidden="true" />
                    Keluar
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main
            className="admin-content"
            onClick={(event) => {
              if (event.target === event.currentTarget && sidebarVisible) setSidebarVisible(false)
            }}
          >
            <Outlet />
          </main>
        </div>
      </div>

      <Toaster
        position="top-right"
        theme="light"
        style={
          {
            '--normal-bg': 'var(--color-surface)',
            '--normal-text': 'var(--color-foreground)',
            '--normal-border': 'var(--color-border)',
            '--border-radius': 'var(--radius-md)',
          } as CSSProperties
        }
      />
    </>
  )
}
