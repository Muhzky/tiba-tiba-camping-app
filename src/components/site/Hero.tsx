import { Link } from '@tanstack/react-router'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Button } from '#/components/ui/button'

const socials = [
  { label: 'Instagram', href: 'https://instagram.com', icon: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 3.2A6.6 6.6 0 1 0 12 18.6 6.6 6.6 0 0 0 12 5.4Zm0 10.9a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6Zm6.8-11.2a1.5 1.5 0 1 1-3.1 0 1.5 1.5 0 0 1 3.1 0Z' },
  { label: 'YouTube', href: 'https://youtube.com', icon: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8L15.5 12 10 15.2Z' },
  { label: 'TikTok', href: 'https://tiktok.com', icon: 'M16.6 5.8a4.8 4.8 0 0 1-1.1-2.8h-3v12.4a2.5 2.5 0 1 1-1.8-2.4V9.9a5.5 5.5 0 1 0 4.8 5.5V9.9a7.8 7.8 0 0 0 4.5 1.4v-3a4.8 4.8 0 0 1-3.4-2.5Z' },
]

const avatars = ['#0A0A0A', '#457AA0', '#6B7280', '#E11D1D']

export function Hero() {
  const reduced = useReducedMotion()
  const { scrollY } = useScroll()
  const parallaxY = useTransform(scrollY, [0, 700], [0, 90])

  return (
    <section className="relative flex min-h-svh items-center overflow-hidden supports-[height:100dvh]:min-h-dvh">
      <motion.img
        src="/images/hero-v1.jpeg"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="hero-fade absolute inset-x-0 -top-[6%] h-[112%] w-full object-cover"
        style={reduced ? undefined : { y: parallaxY }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-36 md:px-8">
        <div className="max-w-3xl">
          <p
            className="hero-in mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/25 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md"
            style={{ animationDelay: '0.2s' }}
          >
            <span className="size-1.5 rounded-full bg-accent" />
            Official distributor — garansi resmi
          </p>

          <h1
            className="hero-in text-4xl font-semibold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '0.32s' }}
          >
            “Outdoor gear — rencana boleh dadakan, gear harus matang.”
          </h1>

          <p
            className="hero-in mt-6 max-w-xl text-base text-white/85 md:text-lg"
            style={{ animationDelay: '0.44s' }}
          >
            Beli, sewa, dan pre-order perlengkapan camping resmi. Katalog lengkap,
            rekomendasi sesuai gaya campingmu, checkout cepat.
          </p>

          <div className="hero-in mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.56s' }}>
            <Button
              size="lg"
              className="rounded-full bg-white px-7 text-base font-semibold text-neutral-950 hover:bg-white/90"
              asChild
            >
              <Link to="/katalog">Mulai Belanja</Link>
            </Button>
            <a
              href="#tentang"
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/40 bg-white/5 px-7 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white hover:text-neutral-950"
            >
              Selengkapnya
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-4 hidden items-center gap-3 md:left-8 md:flex">
        <div className="flex -space-x-3">
          {avatars.map((color) => (
            <span
              key={color}
              className="size-9 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="text-sm font-medium text-white/90">
          <strong className="font-semibold text-white">800+</strong> Pelanggan Puas
        </p>
      </div>

      <nav aria-label="Media sosial" className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-4 lg:flex">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            aria-label={s.label}
            className="grid size-10 place-items-center rounded-full border border-white/30 bg-black/15 text-white/80 backdrop-blur-sm transition hover:border-white hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="size-4.5 fill-current" aria-hidden="true">
              <path d={s.icon} />
            </svg>
          </a>
        ))}
      </nav>

      <Link
        to="/tentang"
        className="absolute bottom-8 right-4 hidden rounded-full border border-white/40 bg-white/5 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white hover:text-neutral-950 md:right-8 md:block"
      >
        Selengkapnya
      </Link>
    </section>
  )
}
