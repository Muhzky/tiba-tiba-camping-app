import { Link } from '@tanstack/react-router'
import { ShoppingBag, CalendarClock, PackageCheck, Sparkles } from 'lucide-react'
import { Reveal } from './Reveal'

const features = [
  {
    title: 'Beli',
    desc: 'Produk ready stock, dikirim cepat, garansi resmi.',
    icon: ShoppingBag,
    to: '/katalog' as const,
  },
  {
    title: 'Sewa',
    desc: 'Sewa harian dengan deposit, unit terawat dan bersih.',
    icon: CalendarClock,
    to: '/katalog' as const,
  },
  {
    title: 'Pre-Order',
    desc: 'Amankan barang langka sebelum stok masuk.',
    icon: PackageCheck,
    to: '/katalog' as const,
  },
  {
    title: 'Rekomendasi Untukmu',
    desc: 'Pilihan gear sesuai gaya dan preferensimu.',
    icon: Sparkles,
    to: '/katalog' as const,
  },
]

export function FeatureCards() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <Reveal key={feature.title}>
            <Link
              to={feature.to}
              className="group flex h-full flex-col gap-6 rounded-3xl bg-surface p-6 transition-colors duration-300 hover:bg-accent hover:text-accent-foreground md:p-7"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-background text-foreground transition-colors group-hover:bg-white/20 group-hover:text-white">
                <feature.icon className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground transition-colors group-hover:text-white/80">
                  {feature.desc}
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
