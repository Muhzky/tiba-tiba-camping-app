import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { LogOut, Menu, Search, ShoppingBag, UserRound } from 'lucide-react'
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '#/components/ui/sheet'
import { Logo } from './Logo'

const menu = [
  { label: 'Katalog', to: '/katalog' as const },
  { label: 'Sewa', to: '/katalog' as const },
  { label: 'Tentang', href: '#tentang' },
  { label: 'Kontak', href: '#kontak' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div
        className={`mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 rounded-full px-4 transition-all duration-300 md:px-6 ${
          scrolled
            ? 'border border-border/70 bg-background/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-lg'
            : 'border border-transparent bg-transparent'
        }`}
      >
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
            <SheetContent side="right" className="flex flex-col gap-2">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              <Logo className="mb-4" />
              {menu.map((item) =>
                'to' in item && item.to ? (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-3 text-sm font-medium hover:bg-surface"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-3 text-sm font-medium hover:bg-surface"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
