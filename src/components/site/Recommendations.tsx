import { useQuery } from '@tanstack/react-query'
import { recommendationsOptions, REASON_LABEL } from '#/server/fn/recommend'
import { ProductCard } from './ProductCard'
import { Reveal } from './Reveal'

export function Recommendations() {
  const { data } = useQuery(recommendationsOptions(4))
  if (!data) return null

  return (
    <section className="mx-auto max-w-7xl px-4 pb-15 md:px-8 md:pb-28">
      <Reveal>
        <div className="mb-8 mt-15">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {data.personalized
              ? 'Dipilih dari produk yang kamu sukai dan beli'
              : 'Masuk untuk rekomendasi personal'}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {data.personalized ? 'Untuk Kamu' : 'Populer'}
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {data.items.map(({ product, reason }) => (
          <Reveal key={product.id}>
            <ProductCard product={product} />
            <p className="mt-2 text-xs text-muted-foreground">{REASON_LABEL[reason]}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
