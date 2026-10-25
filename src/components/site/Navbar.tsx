import { useState, useEffect } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  Compass,
  Heart,
  Home,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Phone,
  Receipt,
  Search,
  Settings2,
  ShoppingBag,
  Tent,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLogout } from '#/lib/use-logout'
import { useSiteSettings } from '#/lib/use-site-settings'
import { openingHoursWithZone, telHref } from '#/lib/site-settings'
import { meOptions } from '#/server/fn/auth'
import { cartOptions } from '#/server/fn/cart'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { Logo } from './Logo'

type MenuItem = {
  label: string
  description: string
  icon: LucideIcon
} & (
  | { to: '/katalog' | '/sewa' | '/tentang'; href?: never }
  | { href: string; to?: never }
)

const menu: MenuItem[] = [
  {
    label: 'Katalog',
    to: '/katalog',
    icon: Compass,
    description: 'Semua gear outdoor',
  },
  {
    label: 'Sewa',
    to: '/sewa',
    icon: Tent,
    description: 'Sewa alat perjalanan',
  },
  {
    label: 'Tentang',
    to: '/tentang',
    icon: Info,
    description: 'Kenali Tiba Tiba Camping',
  },
  {
    label: 'Kontak',
    href: '#kontak',
    icon: Phone,
    description: 'Hubungi tim kami',
  },
]

function MobileMenuItem({
  item,
  index,
  onNavigate,
}: {
  item: MenuItem
  index: number
  onNavigate: () => void
}) {
  const Icon = item.icon
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-foreground/80 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold text-foreground">
          {item.label}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {item.description}
        </span>
      </span>
      <ChevronRight
        className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </>
  )
  const className =
    'group flex animate-in items-center gap-2.5 rounded-xl border border-border/70 bg-card p-2.5 fill-mode-both fade-in slide-in-from-right-2 duration-300 hover:border-foreground/15 hover:bg-surface motion-reduce:animate-none'

  return item.to ? (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={className}
      style={{ animationDelay: `${60 + index * 45}ms` }}
    >
      {content}
    </Link>
  ) : (
    <a
      href={item.href}
      onClick={onNavigate}
      className={className}
      style={{ animationDelay: `${60 + index * 45}ms` }}
    >
      {content}
    </a>
  )
}

type AccountLink =
  '/admin' | '/akun' | '/akun/favorit' | '/akun/pesanan' | '/akun/preferensi'

function AccountMenuItem({
  to,
  icon: Icon,
  label,
}: {
  to: AccountLink
  icon: LucideIcon
  label: string
}) {
  return (
    <DropdownMenuItem
      asChild
      className="gap-2.5 rounded-lg px-2 py-1.5 text-[13px] focus:bg-primary focus:text-primary-foreground"
    >
      <Link to={to}>
        <Icon
          className="size-4 text-muted-foreground group-focus/dropdown-menu-item:text-primary-foreground"
          aria-hidden="true"
        />
        {label}
      </Link>
    </DropdownMenuItem>
  )
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const { data: user } = useQuery(meOptions)
  const userInitial = user?.name.trim().slice(0, 1).toUpperCase() || '?'
  // Staff (admin/owner) mendapat pintasan balik ke panel admin dari situs publik.
  const isStaff = user?.role === 'admin' || user?.role === 'owner'
  const roleLabel = user?.role === 'owner' ? 'Owner' : 'Admin'
  const { data: cart } = useQuery(cartOptions)
  const settings = useSiteSettings()
  const logoutMutation = useLogout()

  const location = useLocation()

  // Deteksi breakpoint desktop via JavaScript agar navigasi desktop tetap
  // tampil dengan benar saat pindah dari layout admin ke publik (Tailwind
  // md: kadang tidak teraplikasi tepat saat navigasi sisi klien).
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
      if (e.matches) setOpen(false)
    }
    setIsDesktop(media.matches)
    if (media.matches) setOpen(false)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  // Tutup sheet mobile saat data autentikasi berubah (mis. login admin lalu
  // pindah ke halaman publik) dan saat navigasi rute di dalam layout publik.
  useEffect(() => {
    setOpen(false)
  }, [user, location.pathname])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 rounded-full px-4 md:px-6">
        <Logo />

        <nav
          aria-label="Menu utama"
          className={`absolute left-1/2 -translate-x-1/2 items-center gap-1 rounded-full bg-surface p-1 ${isDesktop ? 'flex' : 'hidden'} md:flex`}
        >
          {menu.map((item) =>
            'to' in item && item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition hover:bg-primary hover:text-primary-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition hover:bg-primary hover:text-primary-foreground"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Cari produk"
            className="rounded-full"
            asChild
          >
            <Link to="/katalog">
              <Search />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Keranjang"
            className="relative rounded-full"
            asChild
          >
            <Link to="/keranjang">
              <ShoppingBag />
              {cart && cart.count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-sale text-[10px] font-bold text-white">
                  {cart.count}
                </span>
              ) : null}
            </Link>
          </Button>
          {user ? (
            // Non-modal: menu profil tidak perlu mengunci scroll halaman.
            // Mode modal memasang overflow:hidden pada <body>; scrollbar hilang
            // dan navbar fixed ikut bergeser karena tidak dapat kompensasinya.
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Akun ${user.name}`}
                  className="overflow-hidden rounded-full p-0 font-semibold"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    userInitial
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-60 rounded-xl p-1.5 shadow-lg"
              >
                <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      userInitial
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold leading-tight">
                        {user.name}
                      </p>
                      {isStaff ? (
                        <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {roleLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1.5 bg-border/70" />

                {isStaff ? (
                  <AccountMenuItem
                    to="/admin"
                    icon={LayoutDashboard}
                    label="Dashboard admin"
                  />
                ) : (
                  <>
                    <AccountMenuItem
                      to="/akun"
                      icon={Home}
                      label="Ringkasan akun"
                    />
                    <AccountMenuItem
                      to="/akun/favorit"
                      icon={Heart}
                      label="Favorit"
                    />
                    <AccountMenuItem
                      to="/akun/pesanan"
                      icon={Receipt}
                      label="Riwayat pesanan"
                    />
                    <AccountMenuItem
                      to="/akun/preferensi"
                      icon={Settings2}
                      label="Preferensi"
                    />
                  </>
                )}

                <DropdownMenuSeparator className="my-1.5 bg-border/70" />
                <DropdownMenuItem
                  onSelect={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-sale focus:bg-sale focus:text-white"
                >
                  <LogOut
                    className="size-4 group-focus/dropdown-menu-item:text-white"
                    aria-hidden="true"
                  />
                  {logoutMutation.isPending ? 'Sedang keluar…' : 'Keluar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="icon"
              aria-label="Masuk"
              className="rounded-full"
              asChild
            >
              <Link to="/masuk">
                <UserRound />
              </Link>
            </Button>
          )}

          {!isDesktop && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Buka menu"
                  className="rounded-full md:hidden"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-[80vw] max-w-[19rem] flex-col gap-0 p-0 duration-300 ease-out"
              >
                <div className="flex items-center border-b border-border px-4 py-3.5 pr-12">
                  <SheetTitle className="text-[13px] font-semibold tracking-wide">
                    Menu
                  </SheetTitle>
                </div>

                <nav
                  aria-label="Menu utama"
                  className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3"
                >
                  <p className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Jelajahi
                  </p>
                  {menu.map((item, index) => (
                    <MobileMenuItem
                      key={item.label}
                      item={item}
                      index={index}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </nav>

                <div className="mt-auto border-t border-border px-4 py-3">
                  <p className="text-[11px] text-muted-foreground">
                    {openingHoursWithZone(settings)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    <a
                      href={`mailto:${settings.contactEmail}`}
                      className="hover:text-foreground"
                    >
                      {settings.contactEmail}
                    </a>
                  </p>
                  {settings.contactPhone ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <a
                        href={telHref(settings.contactPhone)}
                        className="hover:text-foreground"
                      >
                        {settings.contactPhone}
                      </a>
                    </p>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  )
}
