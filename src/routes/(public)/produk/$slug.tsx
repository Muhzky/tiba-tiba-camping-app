import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { id as idLocale } from 'date-fns/locale'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { productDetailOptions } from '#/server/fn/product'
import type { ProductCardData, ProductDetail } from '#/server/fn/product'
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

const actionButtonClass = 'h-11 w-full rounded-full px-5 text-sm font-semibold sm:text-base'

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
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-40 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-surface">
        <ShoppingBag className="size-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Produk tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Produk mungkin sudah tidak aktif atau salah ketik URL.
      </p>
      <Button asChild className="mt-6 h-11 rounded-full px-6">
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
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 md:px-8 md:pt-32">
      <ProductBreadcrumb product={product} />
      <ProductMain product={product} />
      <ProductInfo product={product} />
      {related.length ? <RelatedProducts products={related} /> : null}
    </div>
  )
}

function ProductBreadcrumb({ product }: { product: ProductDetail }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Link to="/katalog" className="shrink-0 transition-colors hover:text-foreground">
        Katalog
      </Link>
      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="shrink-0">{product.categoryName}</span>
      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate font-medium text-foreground">{product.name}</span>
    </nav>
  )
}

function ProductMain({ product }: { product: ProductDetail }) {
  const [activeImage, setActiveImage] = useState(product.images[0])
  const [color, setColor] = useState(product.variants[0]?.colorName ?? null)
  const [qty, setQty] = useState(1)

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

  const colorNames = [
    ...new Set(product.variants.map((v) => v.colorName).filter(Boolean)),
  ] as string[]

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_460px]">
      <ProductGallery
        product={product}
        activeImage={activeImage}
        onSelect={setActiveImage}
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-surface text-foreground">
            {product.categoryName}
          </Badge>
          {product.isPreorder ? (
            <Badge className="rounded-full bg-accent/10 text-accent">Pre-Order</Badge>
          ) : null}
          <Badge
            className={cn(
              'rounded-full',
              stock > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800',
            )}
          >
            {stock > 0 ? 'Stok tersedia' : 'Stok habis'}
          </Badge>
          <div className="ml-auto">
            <FavoriteButton productId={product.id} />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight md:text-4xl">
            {product.name}
          </h1>
          {product.brandLine ? (
            <p className="mt-2 text-sm text-muted-foreground">{product.brandLine}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
          <p className="text-3xl font-bold leading-none tracking-tight text-sale md:text-4xl">
            {rupiah(discounted)}
          </p>
          {product.discountPercent > 0 ? (
            <div className="flex flex-col gap-1 pb-0.5">
              <span className="text-sm leading-none text-muted-foreground line-through">
                {rupiah(product.salePrice)}
              </span>
              <span className="text-xs font-medium text-sale">
                Hemat {rupiah(product.salePrice - discounted)}
              </span>
            </div>
          ) : null}
        </div>

        {colorNames.length ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Warna</span>
              <span className="text-muted-foreground">{color ?? '—'}</span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih warna">
              {colorNames.map((name) => {
                const hex =
                  product.variants.find((v) => v.colorName === name)?.colorHex ?? '#D1D5DB'
                const active = color === name
                return (
                  <button
                    key={name}
                    type="button"
                    aria-label={`Pilih warna ${name}`}
                    aria-pressed={active}
                    onClick={() => {
                      setColor(name)
                      setQty(1)
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition',
                      active
                        ? 'border-foreground bg-surface font-medium'
                        : 'border-border hover:border-foreground/40',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-3.5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: hex }}
                    />
                    {name}
                  </button>
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
          qty={qty}
          onQtyChange={setQty}
        />

        <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-foreground/70" aria-hidden="true" />
            Garansi resmi
          </li>
          <li className="flex items-center gap-2">
            <Truck className="size-4 shrink-0 text-foreground/70" aria-hidden="true" />
            Pengiriman ke seluruh Indonesia
          </li>
          <li className="flex items-center gap-2">
            <Undo2 className="size-4 shrink-0 text-foreground/70" aria-hidden="true" />
            Tukar unit sewa bila cacat
          </li>
        </ul>
      </div>
    </div>
  )
}

function ProductGallery({
  product,
  activeImage,
  onSelect,
}: {
  product: ProductDetail
  activeImage: string
  onSelect: (image: string) => void
}) {
  const index = Math.max(0, product.images.indexOf(activeImage))

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {product.images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 sm:w-20 sm:shrink-0 sm:flex-col sm:overflow-visible sm:pb-0">
          {product.images.map((image, imageIndex) => (
            <button
              key={image}
              type="button"
              onClick={() => onSelect(image)}
              aria-label={`Lihat gambar ${imageIndex + 1} dari ${product.name}`}
              aria-current={image === activeImage ? 'true' : undefined}
              className={cn(
                'size-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-surface transition sm:size-20',
                image === activeImage
                  ? 'border-foreground'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <img src={image} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative min-w-0 flex-1 overflow-hidden rounded-[2rem] border border-border/60 bg-surface">
        <img
          src={activeImage}
          alt={product.name}
          className="aspect-square w-full object-cover"
        />
        {product.discountPercent > 0 ? (
          <span className="absolute left-4 top-4 rounded-full bg-sale px-3 py-1.5 text-xs font-bold text-white shadow-sm">
            -{product.discountPercent}%
          </span>
        ) : null}
        {product.images.length > 1 ? (
          <span className="absolute bottom-4 right-4 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            {index + 1} / {product.images.length}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function TransactionPanel({
  product,
  discounted,
  stock,
  variantId,
  qty,
  onQtyChange,
}: {
  product: ProductDetail
  discounted: number
  stock: number
  variantId: string | null
  qty: number
  onQtyChange: (qty: number) => void
}) {
  const modes = [
    product.isSellable ? ('beli' as const) : null,
    product.isRentable ? ('sewa' as const) : null,
    product.isPreorder ? ('preorder' as const) : null,
  ].filter(Boolean) as Array<'beli' | 'sewa' | 'preorder'>

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const add = useServerFn(addToCart)
  const initialMode: 'beli' | 'sewa' | 'preorder' =
    modes.includes('beli') && stock > 0
      ? 'beli'
      : modes.includes('preorder')
        ? 'preorder'
        : (modes[0] ?? 'beli')
  const [mode, setMode] = useState<'beli' | 'sewa' | 'preorder'>(initialMode)
  const [pendingAction, setPendingAction] = useState<'cart' | 'checkout' | 'preorder' | null>(
    null,
  )

  const addMutation = useMutation({
    mutationFn: (input: { mode: 'buy' | 'preorder'; qty: number }) =>
      add({ data: { variantId: variantId as string, mode: input.mode, qty: input.qty } }),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartOptions.queryKey, cart)
      toast.success('Masuk keranjang!', {
        action: { label: 'Lihat keranjang', onClick: () => void navigate({ to: '/keranjang' }) },
      })
    },
    onError: () => toast.error('Gagal menambahkan ke keranjang.'),
    onSettled: () => setPendingAction(null),
  })

  if (modes.length === 0) {
    return <p className="text-sm text-muted-foreground">Produk ini sedang tidak dapat dipesan.</p>
  }

  const hasModeTabs = modes.length > 1
  const contentClass = cn('flex flex-col gap-3', hasModeTabs && 'mt-3')
  const maxQty = Math.max(1, stock)
  const safeQty = Math.min(qty, maxQty)
  const buyDisabled = stock === 0 || !variantId || addMutation.isPending
  const selectedSku = product.variants.find((v) => v.id === variantId)?.sku

  return (
    <div className="flex flex-col rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as typeof mode)}
        className="w-full"
      >
        {hasModeTabs ? (
          <TabsList className="flex h-11 w-full gap-1 rounded-full bg-surface p-1">
            {modes.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-full flex-1 gap-1.5 rounded-full px-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {tab === 'beli' ? (
                  <ShoppingBag className="size-4" aria-hidden="true" />
                ) : tab === 'sewa' ? (
                  <CalendarDays className="size-4" aria-hidden="true" />
                ) : (
                  <Clock3 className="size-4" aria-hidden="true" />
                )}
                {tab === 'beli' ? 'Beli' : tab === 'sewa' ? 'Sewa' : 'Pre-Order'}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}

        {modes.includes('beli') ? (
          <TabsContent value="beli" className={contentClass}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    stock > 0 ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                {stock > 0 ? `${stock} unit tersedia` : 'Stok habis'}
              </span>
              {selectedSku ? (
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                  SKU {selectedSku}
                </span>
              ) : null}
            </div>

            <div className="flex h-11 items-center justify-between gap-3 rounded-full border border-border bg-background px-3">
              <span className="text-sm text-muted-foreground">Jumlah</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  disabled={safeQty <= 1 || buyDisabled}
                  onClick={() => onQtyChange(safeQty - 1)}
                  className="grid size-8 place-items-center rounded-full transition hover:bg-surface disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span
                  className="w-8 text-center text-sm font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {safeQty}
                </span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  disabled={safeQty >= stock || buyDisabled}
                  onClick={() => onQtyChange(safeQty + 1)}
                  className="grid size-8 place-items-center rounded-full transition hover:bg-surface disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <Button
              className={actionButtonClass}
              disabled={buyDisabled}
              onClick={() => {
                setPendingAction('cart')
                addMutation.mutate({ mode: 'buy', qty: safeQty })
              }}
            >
              {pendingAction === 'cart' ? 'Menambahkan…' : 'Masukkan Keranjang'}
            </Button>
            <Button
              variant="outline"
              className={actionButtonClass}
              disabled={buyDisabled}
              onClick={() => {
                setPendingAction('checkout')
                addMutation.mutate(
                  { mode: 'buy', qty: safeQty },
                  { onSuccess: () => void navigate({ to: '/checkout' }) },
                )
              }}
            >
              {pendingAction === 'checkout' ? 'Membuka checkout…' : 'Beli Sekarang'}
            </Button>
          </TabsContent>
        ) : null}

        {modes.includes('sewa') ? (
          <TabsContent value="sewa" className={contentClass}>
            <RentalPanel product={product} variantId={variantId} />
          </TabsContent>
        ) : null}

        {modes.includes('preorder') ? (
          <TabsContent value="preorder" className={contentClass}>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-surface/60 p-3">
                <p className="text-xs text-muted-foreground">Estimasi ready</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {product.preorderEta
                    ? format(new Date(product.preorderEta), 'd MMM yyyy', { locale: idLocale })
                    : 'Menyusul'}
                </p>
              </div>
              <div className="rounded-2xl bg-surface/60 p-3">
                <p className="text-xs text-muted-foreground">DP</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {product.preorderDpPercent
                    ? `${product.preorderDpPercent}% · ${rupiah(
                        Math.round((discounted * product.preorderDpPercent) / 100),
                      )}`
                    : 'Tanpa DP'}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {product.preorderDpPercent
                ? 'Sisanya dilunasi saat barang ready.'
                : 'Pelunasan dilakukan saat barang ready.'}
            </p>
            <Button
              className={actionButtonClass}
              disabled={!variantId || addMutation.isPending}
              onClick={() => {
                setPendingAction('preorder')
                addMutation.mutate({ mode: 'preorder', qty: 1 })
              }}
            >
              {pendingAction === 'preorder' ? 'Memproses…' : 'Amankan Pre-Order'}
            </Button>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
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
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-surface/60 p-3">
          <p className="text-xs text-muted-foreground">Sewa per hari</p>
          <p className="mt-0.5 text-sm font-semibold">
            {product.rentPricePerDay ? rupiah(product.rentPricePerDay) : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-surface/60 p-3">
          <p className="text-xs text-muted-foreground">Deposit</p>
          <p className="mt-0.5 text-sm font-semibold">50% dari total sewa</p>
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-11 w-full justify-start gap-2 rounded-full px-4 font-normal"
          >
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{label}</span>
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
        <div className="flex flex-col gap-3 rounded-2xl bg-surface/60 p-4 text-sm">
          <Row
            label={`Sewa ${data.days} hari × ${rupiah(data.rentPerDay)}`}
            value={rupiah(data.rentTotal)}
          />
          <Row label="Deposit sewa 50% (dikembalikan)" value={rupiah(data.deposit)} />
          <div className="border-t border-border/70 pt-2">
            <Row label="Total bayar" value={rupiah(data.rentTotal + data.deposit)} bold />
          </div>
          <p className={data.available ? 'text-emerald-700' : 'text-sale'}>
            {data.available
              ? `${data.freeUnits} unit tersedia pada tanggal tersebut`
              : 'Semua unit terpakai pada tanggal tersebut — coba tanggal lain'}
          </p>
          <Button
            className={actionButtonClass}
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

function ProductInfo({ product }: { product: ProductDetail }) {
  return (
    <section className="mt-14 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <article className="rounded-[28px] border border-border/70 bg-card p-6 md:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Deskripsi</h2>
        {product.description.trim() ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada deskripsi untuk produk ini.
          </p>
        )}
      </article>

      <article className="rounded-[28px] border border-border/70 bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Spesifikasi</h2>
        {product.specs.length ? (
          <dl className="mt-3 divide-y divide-border/60 text-sm">
            {product.specs.map((spec) => (
              <div key={spec.name} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{spec.name}</dt>
                <dd className="text-right font-medium">{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Belum ada data spesifikasi.</p>
        )}
      </article>
    </section>
  )
}

function RelatedProducts({ products }: { products: ProductCardData[] }) {
  return (
    <section className="mt-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Produk serupa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilihan lain yang paling mirip dengan produk ini.
          </p>
        </div>
        <Link
          to="/katalog"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Lihat katalog
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {products.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
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
