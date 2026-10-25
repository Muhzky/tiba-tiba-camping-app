import { Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { Logo } from './Logo'
import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
  YoutubeIcon,
} from './SocialIcons'
import { useSiteSettings } from '#/lib/use-site-settings'
import { openingHoursLine, socialLinks, telHref } from '#/lib/site-settings'
import type { SocialLink } from '#/lib/site-settings'

const columns = [
  {
    title: 'Belanja',
    links: [
      { label: 'Katalog', to: '/katalog' },
      { label: 'Sewa Alat', to: '/sewa' },
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

const socialIcons: Record<SocialLink['key'], typeof InstagramIcon> = {
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  facebook: FacebookIcon,
  tiktok: TiktokIcon,
}

export function Footer() {
  const settings = useSiteSettings()
  const socials = socialLinks(settings)
  const hours = openingHoursLine(settings)

  return (
    <footer id="kontak" className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="flex flex-col items-start gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {settings.footerDescription}
            </p>
            <Link
              to="/tentang"
              className="text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              Tentang kami
            </Link>
            {socials.length ? (
              <div className="flex gap-2">
                {socials.map(({ key, label, url }) => {
                  const Icon = socialIcons[key]
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={label}
                      title={label}
                      className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
                    >
                      <Icon className="size-4" />
                    </a>
                  )
                })}
              </div>
            ) : null}
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
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide">
              Kontak
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {settings.address ? (
                <li className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{settings.address}</span>
                </li>
              ) : null}
              {settings.contactEmail ? (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="underline-offset-4 transition hover:text-foreground hover:underline"
                  >
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              {settings.contactPhone ? (
                <li>
                  <a
                    href={telHref(settings.contactPhone)}
                    className="underline-offset-4 transition hover:text-foreground hover:underline"
                  >
                    {settings.contactPhone}
                  </a>
                </li>
              ) : null}
              {hours || settings.timezone ? (
                <li>
                  {hours}
                  {hours && settings.timezone ? <br /> : null}
                  {settings.timezone}
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} Tiba Tiba Camping. Semua hak
            dilindungi.
          </p>
          <p>Distributor resmi — garansi resmi berlaku.</p>
        </div>
      </div>
    </footer>
  )
}
