import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CalendarClock,
  Check,
  Clock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Reveal } from '#/components/site/Reveal'

export const Route = createFileRoute('/(public)/tentang')({
  head: () => ({
    meta: [
      { title: 'Tentang — Tiba Tiba Camping' },
      {
        name: 'description',
        content:
          'Tiba Tiba Camping adalah distributor resmi perlengkapan outdoor ALLTREK: beli, sewa, dan pre-order gear bergaransi resmi.',
      },
    ],
  }),
  component: TentangPage,
})

const stats = [
  { value: '800+', label: 'Pelanggan puas' },
  { value: '3', label: 'Cara menikmati gear' },
  { value: '100%', label: 'Produk original' },
  { value: '1', label: 'Merek resmi: ALLTREK' },
]

const values = [
  {
    icon: ShieldCheck,
    title: 'Garansi resmi',
    desc: 'Setiap unit berasal dari distributor resmi ALLTREK dan datang lengkap dengan kartu garansi.',
  },
  {
    icon: CalendarClock,
    title: 'Beli, sewa, atau pre-order',
    desc: 'Pilih yang paling masuk akal: memiliki, menyewa untuk satu trip, atau mengamankan stok berikutnya.',
  },
  {
    icon: Sparkles,
    title: 'Rekomendasi yang relevan',
    desc: 'Katalog dan saran gear menyesuaikan gaya camping, jumlah orang, dan budgetmu.',
  },
  {
    icon: Wrench,
    title: 'Dirawat sebelum sampai',
    desc: 'Unit sewa dibersihkan dan diperiksa kondisinya sebelum dikirim ke tanganmu.',
  },
]

const guarantees = [
  'Produk 100% original',
  'Garansi resmi berlaku',
  'Klaim langsung ke distributor',
]

function TentangPage() {
  return (
    <div className="pb-24">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-32 md:px-8 md:pb-20 md:pt-36">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent" />
              Tentang kami
            </p>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Gear matang untuk rencana yang dadakan.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Tiba Tiba Camping adalah distributor resmi perlengkapan outdoor
              ALLTREK di Indonesia. Kami percaya perjalanan terbaik sering
              dimulai dari rencana mendadak — dan yang membuatnya nyaman adalah
              gear yang tepat, terawat, dan bergaransi resmi.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-11 rounded-full px-7 text-base font-semibold"
                asChild
              >
                <Link to="/katalog">Jelajahi Katalog</Link>
              </Button>
              <a
                href="#kontak"
                className="inline-flex h-11 items-center justify-center rounded-full border border-foreground/30 px-7 text-base font-medium transition hover:bg-foreground hover:text-background"
              >
                Hubungi Kami
              </a>
            </div>
          </Reveal>

          <Reveal>
            <div className="relative mx-auto w-full max-w-md">
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-[40px] bg-surface/70 blur-2xl"
              />
              <div className="relative grid place-items-center rounded-[32px] border border-border/70 bg-surface px-8 py-10 md:px-12 md:py-14">
                <img
                  src="/images/logo-ttc.png"
                  alt="Logo Tiba Tiba Camping"
                  width={320}
                  height={299}
                  className="h-52 w-auto md:h-64"
                />
                <p className="mt-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Official distributor ALLTREK
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4 md:px-8 md:py-12">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-semibold tracking-tight md:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <Reveal>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Kenapa belanja di sini?
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Kami hanya menjual satu merek karena ingin benar-benar
              mengenalnya. Itu membuat kami bisa menjelaskan bedanya tenda kubah
              dan tunnel, kapan sleeping bag 0°C berlebihan, dan gear mana yang
              lebih baik disewa daripada dibeli.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {values.map((value) => (
              <Reveal key={value.title} className="h-full">
                <div className="flex h-full flex-col gap-5 rounded-3xl bg-surface p-6 md:p-7">
                  <span className="grid size-12 place-items-center rounded-2xl bg-background text-foreground">
                    <value.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{value.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {value.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
        <Reveal>
          <div className="overflow-hidden rounded-[32px] bg-foreground px-6 py-10 text-background md:px-12 md:py-14">
            <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
              <div className="grid size-28 place-items-center rounded-3xl bg-background p-3 md:size-32">
                <img
                  src="/images/logo-ttc.png"
                  alt=""
                  aria-hidden="true"
                  width={320}
                  height={299}
                  className="h-full w-auto"
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-background/60">
                  Official distributor
                </p>
                <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                  ALLTREK, resmi dan bergaransi.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-background/70 md:text-base">
                  Semua produk yang kami jual, sewakan, dan pre-order berasal
                  dari jalur distribusi resmi. Kalau ada kendala, klaim
                  garansinya kami bantu urus langsung ke distributor — bukan
                  dilempar ke sana-sini.
                </p>
                <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-background/80">
                  {guarantees.map((item) => (
                    <li key={item} className="inline-flex items-center gap-2">
                      <Check
                        className="size-4 text-accent"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-8 rounded-[32px] border border-border/70 bg-surface/60 p-8 md:grid-cols-2 md:items-center md:p-12">
          <div>
            <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              Punya pertanyaan soal gear?
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              Ceritakan rencana trip-mu — jumlah orang, lokasi, dan cuaca yang
              diperkirakan. Tim kami bantu pilih gear yang pas, bukan yang
              paling mahal.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="size-4" aria-hidden="true" />
                <a
                  href="mailto:halo@tibatibacamping.test"
                  className="hover:text-foreground"
                >
                  halo@tibatibacamping.test
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4" aria-hidden="true" />
                <a href="tel:+6281200000000" className="hover:text-foreground">
                  +62 812-0000-0000
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4" aria-hidden="true" />
                Senin–Sabtu, 09.00–18.00 WIB
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Button
              size="lg"
              className="h-11 w-full rounded-full px-7 text-base font-semibold md:w-auto"
              asChild
            >
              <Link to="/katalog">Mulai Belanja</Link>
            </Button>
            <a
              href="mailto:halo@tibatibacamping.test"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-foreground/20 px-7 text-base font-medium transition hover:bg-foreground hover:text-background md:w-auto"
            >
              Email kami
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
