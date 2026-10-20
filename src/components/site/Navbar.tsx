import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  ChevronRight,
  Compass,
  Info,
  LogOut,
  Menu,
  Phone,
  Search,
  ShoppingBag,
  Tent,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { logout, meOptions } from '#/server/fn/auth'
import { cartOptions } from '#/server/fn/cart'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  { to: '/katalog' | '/tentang'; href?: never } | { href: string; to?: never }
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
    to: '/katalog',
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

export function Navbar() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: user } = useQuery(meOptions)
  const { data: cart } = useQuery(cartOptions)
  const signOut = useServerFn(logout)
  const logoutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meOptions.queryKey })
      toast.success('Kamu sudah keluar.')
    },
  })

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 rounded-full px-4 md:px-6">
        <Logo />

        <nav
          aria-label="Menu utama"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full bg-surface p-1 md:flex"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Akun ${user.name}`}
                  className="rounded-full font-semibold"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/akun">Ringkasan akun</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/akun/favorit">Favorit</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/akun/pesanan">Riwayat pesanan</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut />
                  Keluar
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
                  Senin–Sabtu, 09.00–18.00 WIB
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  halo@tibatibacamping.test
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
