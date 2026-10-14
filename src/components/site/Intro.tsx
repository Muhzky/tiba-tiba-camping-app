import { Link } from '@tanstack/react-router'
import { Reveal } from './Reveal'

export function Intro() {
  return (
    <section id="tentang" className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:grid-cols-2 md:px-8 md:py-28">
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
          Gear matang untuk rencana yang dadakan
        </h2>
      </Reveal>
      <Reveal className="flex flex-col items-start gap-6 md:pt-3">
        <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
          Kami distributor resmi perlengkapan outdoor: tenda, sleeping bag, kompor, carrier, dan
          aksesori lain. Semua produk bergaransi resmi, bisa dibeli, disewa, atau di-pre-order —
          jadi rencana mendadakmu tetap berangkat dengan gear yang siap.
        </p>
        <Link
          to="/katalog"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Belanja Sekarang
        </Link>
      </Reveal>
    </section>
  )
}
