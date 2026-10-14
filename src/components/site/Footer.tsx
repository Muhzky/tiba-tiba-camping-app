import { Link } from '@tanstack/react-router'
import { Logo } from './Logo'

const columns = [
  {
    title: 'Belanja',
    links: [
      { label: 'Katalog', to: '/katalog' },
      { label: 'Sewa Alat', to: '/katalog' },
      { label: 'Keranjang', to: '/keranjang' },
    ],
  },
  {
    title: 'Akun',
    links: [
      { label: 'Masuk', to: '/masuk' },
      { label: 'Daftar', to: '/daftar' },
      { label: 'Riwayat Pesanan', to: '/akun/pesanan' },
    ],
  },
]

const socials = ['Instagram', 'YouTube', 'TikTok']

export function Footer() {
  return (
    <footer id="kontak" className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="flex flex-col items-start gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              “Outdoor gear — rencana boleh dadakan, gear harus matang.”
            </p>
            <div className="flex gap-2">
              {socials.map((social) => (
                <a
                  key={social}
                  href="#kontak"
                  aria-label={social}
                  className="grid size-9 place-items-center rounded-full border border-border text-xs font-semibold text-muted-foreground transition hover:border-foreground hover:text-foreground"
                >
                  {social.slice(0, 2).toUpperCase()}
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide">
                {column.title}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide">Kontak</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>halo@tibatibacamping.test</li>
              <li>+62 812-0000-0000</li>
              <li>
                Senin–Sabtu, 09.00–18.00
                <br />
                WIB (Asia/Jakarta)
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Tiba Tiba Camping. Semua hak dilindungi.</p>
          <p>Distributor resmi — garansi resmi berlaku.</p>
        </div>
      </div>
    </footer>
  )
}
