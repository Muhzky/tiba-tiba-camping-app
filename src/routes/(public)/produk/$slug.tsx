import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { id as idLocale } from 'date-fns/locale'
import { CalendarIcon, ShieldCheck, Truck, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { productDetailOptions  } from '#/server/fn/product'
import type {ProductDetail} from '#/server/fn/product';
import { relatedProductsOptions } from '#/server/fn/katalog'
import { checkRentalAvailability } from '#/server/fn/rental'
import { addToCart, cartOptions } from '#/server/fn/cart'
import { rupiah } from '#/lib/format'
import { Badge } from '#/components/ui/badge'
import { FavoriteButton } from '#/components/site/FavoriteButton'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { ProductCard } from '#/components/site/ProductCard'
import { cn } from 'cn'

export const Route = createFileRoute('/(public)/produk/$slug')({
  loader: async ({ context, params }) => {
    const [detail] = await Promise.all([
      context.queryClient.fetchQuery(productDetailOptions(params.slug)),
      context.queryClient.fetchQuery(relatedProductsOptions(params.slug)),
    ])
    return detail
  },
  head: ({ loaderData }) => {
    const product = loaderData
    if (!product) {
      return { meta: [{ title: 'Produk tidak ditemukan — Tiba Tiba Camping' }] }
    }
    const url = product.canonicalUrl
    const images = product.images.map((i) => new URL(i, url).href)
    const inStock = product.variants.some((v) => v.stock > 0)
    const brand = product.brandLine
      ? { '@type': 'Brand' as const, name: product.brandLine }
      : { '@type': 'Brand' as const, name: 'Tiba Tiba Camping' }
    return {
      meta: [
        { title: `${product.name} — Tiba Tiba Camping` },
        { name: 'description', content: product.description.slice(0, 160) },
        { property: 'og:title', content: product.name },
        { property: 'og:description', content: product.description.slice(0, 160) },
        { property: 'og:type', content: 'product' },
        { property: 'og:url', content: url },
        { property: 'og:image', content: images[0] },
        {
          'script:ld+json': {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            url,
            image: images,
            brand,
            category: product.categoryName,
            ...(product.isSellable
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: product.price,
                    priceCurrency: 'IDR',
                    url,
                    availability: inStock
                      ? 'https://schema.org/InStock'
                      : 'https://schema.org/OutOfStock',
                  },
                }
              : {}),
          },
        },
      ],
      links: [{ rel: 'canonical', href: url }],
    }
  },
  component: ProductDetailPage,
  notFoundComponent: ProductNotFound,
})

function ProductNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-40 text-center">
      <h1 className="text-2xl font-semibold">Produk tidak ditemukan</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Produk mungkin sudah tidak aktif atau salah ketik URL.
      </p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/katalog">Lihat katalog</Link>
      </Button>
    </div>
  )
}

function ProductDetailPage() {
  const { slug } = Route.useParams()
  const { data: product } = useSuspenseQuery(productDetailOptions(slug))
  const { data: related } = useSuspenseQuery(relatedProductsOptions(slug))

  if (!product) return <ProductNotFound />

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 md:px-8">
      <ProductMain product={product} />

      {related.length ? (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl">
            Produk Serupa
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ProductMain({ product }: { product: ProductDetail }) {
  const [activeImage, setActiveImage] = useState(product.images[0])
  const [color, setColor] = useState(product.variants[0]?.colorName ?? null)

  const discounted = Math.round(
    product.salePrice - (product.salePrice * product.discountPercent) / 100,
  )
  const selectedVariant =
    product.variants.find((v) => v.colorName === color && v.stock > 0) ??
    product.variants.find((v) => v.colorName === color) ??
    product.variants.at(0) ??
    null

  const stock = product.variants
    .filter((v) => (color ? v.colorName === color : true))
    .reduce((sum, v) => sum + v.stock, 0)

  const colorNames = [...new Set(product.variants.map((v) => v.colorName).filter(Boolean))] as string[]

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-[28px] bg-surface">
          <img
            src={activeImage}
            alt={product.name}
            className="aspect-square size-full object-cover"
          />
        </div>
        {product.images.length > 1 ? (
          <div className="flex gap-3">
            {product.images.map((image) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveImage(image)}
                aria-label={`Lihat gambar ${product.name}`}
                className={cn(
                  'size-16 overflow-hidden rounded-2xl border-2 bg-white/60 transition',
                  image === activeImage ? 'border-foreground' : 'border-transparent opacity-70',
                )}
              >
                <img src={image} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-surface text-foreground">{product.categoryName}</Badge>
          {product.discountPercent > 0 ? (
            <Badge className="rounded-full bg-sale text-white">-{product.discountPercent}%</Badge>
          ) : null}
          {stock > 0 ? (
            <Badge className="rounded-full bg-emerald-100 text-emerald-800">Stok tersedia</Badge>
          ) : (
            <Badge className="rounded-full bg-amber-100 text-amber-800">Stok habis</Badge>
          )}
          <div className="ml-auto">
            <FavoriteButton productId={product.id} />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{product.name}</h1>
          {product.brandLine ? (
            <p className="mt-1 text-sm text-muted-foreground">{product.brandLine}</p>
          ) : null}
        </div>

        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold text-sale">{rupiah(discounted)}</p>
          {product.discountPercent > 0 ? (
            <p className="text-base text-muted-foreground line-through">
              {rupiah(product.salePrice)}
            </p>
          ) : null}
        </div>

        {colorNames.length > 1 ? (
          <div>
            <p className="mb-2 text-sm font-medium">
              Warna: <span className="font-normal text-muted-foreground">{color ?? '-'}</span>
            </p>
            <div className="flex gap-2">
              {colorNames.map((name) => {
                const variant = product.variants.find((v) => v.colorName === name)
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={`Pilih warna ${name}`}
                    aria-pressed={color === name}
                    onClick={() => setColor(name)}
                    className={cn(
                      'size-8 rounded-full border-2 transition',
                      color === name ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                    )}
                    style={{ backgroundColor: variant?.colorHex ?? '#D1D5DB' }}
                  />
                )
              })}
            </div>
          </div>
        ) : null}

        <TransactionPanel
          product={product}
          discounted={discounted}
          stock={stock}
          variantId={selectedVariant?.id ?? null}
        />

        <div className="rounded-2xl border border-border p-4">
          <p className="mb-3 text-sm font-semibold">Spesifikasi</p>
          {product.specs.length ? (
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {product.specs.map((spec) => (
                <div key={spec.name} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                  <dt className="text-muted-foreground">{spec.name}</dt>
                  <dd className="font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada data spesifikasi.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> Garansi resmi
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="size-4" /> Pengiriman seluruh Indonesia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Undo2 className="size-4" /> Tukar unit sewa bila cacat
          </span>
        </div>
      </div>
    </div>
  )
}

function TransactionPanel({
  product,
  discounted,
  stock,
  variantId,
}: {
  product: ProductDetail
  discounted: number
  stock: number
  variantId: string | null
}) {
  const modes = [
    product.isSellable ? ('beli' as const) : null,
    product.isRentable ? ('sewa' as const) : null,
    product.isPreorder ? ('preorder' as const) : null,
  ].filter(Boolean) as Array<'beli' | 'sewa' | 'preorder'>

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const add = useServerFn(addToCart)
  const addMutation = useMutation({
    mutationFn: (mode: 'buy' | 'preorder') =>
      add({ data: { variantId: variantId as string, mode, qty: 1 } }),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartOptions.queryKey, cart)
      toast.success('Masuk keranjang!', {
        action: { label: 'Lihat keranjang', onClick: () => void navigate({ to: '/keranjang' }) },
      })
    },
    onError: () => toast.error('Gagal menambahkan ke keranjang.'),
  })

  if (modes.length === 0) {
    return <p className="text-sm text-muted-foreground">Produk ini sedang tidak dapat dipesan.</p>
  }

  return (
    <Tabs defaultValue={modes[0]} className="w-full">
      <TabsList className="h-auto w-full flex-wrap rounded-full bg-surface p-1">
        {modes.map((mode) => (
          <TabsTrigger
            key={mode}
            value={mode}
            className="flex-1 rounded-full px-4 py-2 text-sm font-medium"
          >
            {mode === 'beli' ? 'Beli' : mode === 'sewa' ? 'Sewa' : 'Pre-Order'}
          </TabsTrigger>
        ))}
      </TabsList>

      {modes.includes('beli') ? (
        <TabsContent value="beli" className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {stock > 0 ? `Siap kirim — ${stock} unit tersedia.` : 'Stok habis.'}
          </p>
          <Button
            className="h-11 rounded-full text-base font-semibold"
            disabled={stock === 0 || !variantId || addMutation.isPending}
            onClick={() => addMutation.mutate('buy')}
          >
            Tambah ke Keranjang — {rupiah(discounted)}
          </Button>
        </TabsContent>
      ) : null}

      {modes.includes('sewa') ? (
        <TabsContent value="sewa" className="mt-4">
          <RentalPanel product={product} variantId={variantId} />
        </TabsContent>
      ) : null}

      {modes.includes('preorder') ? (
        <TabsContent value="preorder" className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {product.preorderEta
              ? `Estimasi tersedia: ${format(new Date(product.preorderEta), 'd MMMM yyyy', { locale: idLocale })}`
              : 'Estimasi ketersediaan menyusul.'}
          </p>
          {product.preorderDpPercent ? (
            <p className="text-sm">
              DP {product.preorderDpPercent}%:{' '}
              <span className="font-semibold text-sale">
                {rupiah(Math.round((discounted * product.preorderDpPercent) / 100))}
              </span>{' '}
              <span className="text-muted-foreground">sisanya saat barang ready</span>
            </p>
          ) : (
            <p className="text-sm">Pelunasan saat barang ready.</p>
          )}
          <Button
            className="h-11 rounded-full text-base font-semibold"
            disabled={!variantId || addMutation.isPending}
            onClick={() => addMutation.mutate('preorder')}
          >
            Amankan Pre-Order
          </Button>
        </TabsContent>
      ) : null}
    </Tabs>
  )
}

function RentalPanel({ product, variantId }: { product: ProductDetail; variantId: string | null }) {
  const [range, setRange] = useState<DateRange | undefined>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const add = useServerFn(addToCart)
  const addRentMutation = useMutation({
    mutationFn: () =>
      add({
        data: {
          variantId: variantId as string,
          mode: 'rent' as const,
          qty: 1,
          rentStart: range?.from?.toISOString(),
          rentEnd: range?.to?.toISOString(),
        },
      }),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartOptions.queryKey, cart)
      toast.success('Sewa masuk keranjang!', {
        action: {
          label: 'Lihat keranjang',
          onClick: () => void navigate({ to: '/keranjang' }),
        },
      })
    },
    onError: () => toast.error('Gagal menambahkan sewa ke keranjang.'),
  })

  const ready = Boolean(range?.from && range.to)
  const availability = useQuery({
    queryKey: ['rental-availability', product.id, range?.from, range?.to],
    queryFn: () =>
      checkRentalAvailability({
        data: {
          productId: product.id,
          start: range!.from!.toISOString(),
          end: range!.to!.toISOString(),
        },
      }),
    enabled: ready,
  })

  const label = useMemo(() => {
    if (!range?.from) return 'Pilih tanggal sewa'
    if (!range.to) return `${format(range.from, 'd MMM yyyy', { locale: idLocale })} — pilih selesai`
    return `${format(range.from, 'd MMM yyyy', { locale: idLocale })} – ${format(range.to, 'd MMM yyyy', { locale: idLocale })}`
  }, [range])

  const data = availability.data

  return (
    <div className="flex flex-col gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-11 w-full justify-start gap-2 rounded-full px-4 font-normal"
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={2}
            disabled={{ before: new Date() }}
          />
        </PopoverContent>
      </Popover>

      {availability.isFetching ? (
        <p className="text-sm text-muted-foreground">Mengecek ketersediaan unit…</p>
      ) : null}

      {availability.isError ? (
        <p role="alert" className="text-sm text-sale">
          {availability.error instanceof Error
            ? availability.error.message
            : 'Gagal mengecek ketersediaan.'}
        </p>
      ) : null}

      {data && !availability.isFetching ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border p-4 text-sm">
          <Row label={`Sewa ${data.days} hari × ${rupiah(data.rentPerDay)}`} value={rupiah(data.rentTotal)} />
          <Row label="Deposit (dikembalikan)" value={rupiah(data.deposit)} />
          <div className="border-t border-border pt-2">
            <Row
              label="Total bayar"
              value={rupiah(data.rentTotal + data.deposit)}
              bold
            />
          </div>
          <p className={data.available ? 'text-emerald-700' : 'text-sale'}>
            {data.available
              ? `${data.freeUnits} unit tersedia pada tanggal tersebut`
              : 'Semua unit terpakai pada tanggal tersebut — coba tanggal lain'}
          </p>
          <Button
            className="h-11 rounded-full text-base font-semibold"
            disabled={!data.available || !variantId || addRentMutation.isPending}
            onClick={() => addRentMutation.mutate()}
          >
            {addRentMutation.isPending
              ? 'Menambahkan…'
              : `Sewa Sekarang — ${rupiah(data.rentTotal + data.deposit)}`}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={bold ? 'text-sale' : ''}>{value}</span>
    </div>
  )
}
