import { Reveal } from './Reveal'

const lines = ['Tenda', 'Sleeping Bag', 'Kompor', 'Carrier', 'Matras', 'Lampu', 'Aksesori']
const payments = ['BCA', 'Mandiri', 'BNI', 'QRIS', 'Visa', 'Mastercard']

export function BrandBand() {
  return (
    <section className="bg-primary py-14 text-primary-foreground md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Official Distributor
            </p>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Garansi Resmi
            </span>
          </div>
        </Reveal>
      </div>

      <div className="mt-10 overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap will-change-transform">
          {Array.from({ length: 4 }).flatMap((_, block) =>
            lines.map((line) => (
              <span
                key={`${block}-${line}`}
                className="text-3xl font-semibold tracking-tight text-white/35 md:text-4xl"
              >
                {/* TODO: aset resmi — logo merek asli menggantikan teks ini */}
                TibaTiba<span className="italic">·</span> {line}
              </span>
            )),
          )}
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-8">
          <div className="flex flex-wrap gap-2">
            {lines.map((line) => (
              <span
                key={line}
                className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80"
              >
                {line}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className="font-semibold text-white/70">Pembayaran:</span>
            {payments.map((p) => (
              <span key={p} className="font-medium">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
