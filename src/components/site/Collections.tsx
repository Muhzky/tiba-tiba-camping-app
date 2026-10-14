import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Reveal } from './Reveal'

const collections = [
  {
    title: 'Tenda 4 Musim',
    desc: 'Tangguh di hujan dan angin — untuk pendakian serius.',
    dark: false,
    image: '/images/placeholder-product.svg',
    href: '/katalog',
  },
  {
    title: 'Tenda Ringkas',
    desc: 'Ringan dan cepat pasang — dadakan tetap berangkat.',
    dark: true,
    image: '/images/placeholder-product.svg',
    href: '/katalog',
  },
]

export function Collections() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
      <Reveal>
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Koleksi Serbaguna</h2>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {collections.map((collection) => (
          <Reveal key={collection.title}>
            <article
              className={`group relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[28px] p-7 md:min-h-[460px] md:p-9 ${
                collection.dark ? 'bg-primary text-primary-foreground' : 'bg-surface'
              }`}
            >
              <div className="relative z-10 max-w-[60%]">
                <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {collection.title}
                </h3>
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    collection.dark ? 'text-white/70' : 'text-muted-foreground'
                  }`}
                >
                  {collection.desc}
                </p>
                <Link
                  to={collection.href}
                  className={`mt-6 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition ${
                    collection.dark
                      ? 'bg-white text-foreground hover:bg-white/90'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  Jelajahi
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <img
                src={collection.image}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className={`pointer-events-none absolute -bottom-10 -right-6 w-[58%] rotate-6 rounded-3xl opacity-90 transition-transform duration-500 group-hover:scale-105 ${
                  collection.dark ? 'mix-blend-luminosity' : ''
                }`}
              />
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
