import { useQuery } from '@tanstack/react-query'
import { bestSellersOptions } from '#/server/fn/product'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '#/components/ui/carousel'
import { ProductCard } from './ProductCard'
import { Reveal } from './Reveal'

export function BestSellers() {
  const { data: products } = useQuery(bestSellersOptions)
  if (!products) return null

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
      <Reveal>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Paling banyak dibeli</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Terlaris</h2>
          </div>
        </div>
      </Reveal>

      <Carousel
        opts={{ align: 'start', loop: true }}
        className="group/carousel relative md:[&>[data-slot=carousel-prev]]:-left-6 md:[&>[data-slot=carousel-next]]:-right-6"
      >
        <CarouselContent className="-ml-4 md:-ml-6">
          {products.map((product) => (
            <CarouselItem
              key={product.id}
              className="basis-[80%] pl-4 sm:basis-[45%] md:basis-[32%] md:pl-6 lg:basis-[24%]"
            >
              <ProductCard product={product} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden bg-background shadow-md md:flex" />
        <CarouselNext className="hidden bg-background shadow-md md:flex" />
      </Carousel>
    </section>
  )
}
