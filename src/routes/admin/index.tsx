import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Chart from 'chart.js/auto'
import {
  Coins,
  PackageOpen,
  ReceiptText,
  Tent,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { adminOverviewOptions, adminSalesOptions } from '#/server/fn/admin'
import type { AdminSalesSeries } from '#/server/fn/admin'
import { meOptions } from '#/server/fn/auth'
import { formatDate, rupiah } from '#/lib/format'
import { ORDER_TYPE_LABEL, customerLabel } from '#/lib/order-status'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { OrderStatusBadge } from '#/components/admin/badge'
import { EmptyState } from '#/components/admin/empty'
import { buttonClass } from '#/components/admin/button'

type PeriodId = 'today' | '7d' | '30d' | 'custom'

const PERIODS: Array<{ id: PeriodId; label: string }> = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 hari' },
  { id: '30d', label: '30 hari' },
  { id: 'custom', label: 'Custom' },
]

/** 'YYYY-MM-DD' menurut kalender lokal (server). */
function ymdOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysAgo(n: number): string {
  return ymdOf(new Date(Date.now() - n * 86_400_000))
}

/** Rentang tanggal aktif (from, to) untuk satu periode. */
function rangeForPeriod(
  period: PeriodId,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  switch (period) {
    case 'today':
      return { from: ymdOf(new Date()), to: ymdOf(new Date()) }
    case '7d':
      return { from: daysAgo(6), to: ymdOf(new Date()) }
    case '30d':
      return { from: daysAgo(29), to: ymdOf(new Date()) }
    case 'custom':
      return { from: customFrom, to: customTo }
  }
}

function chartLabelOf(point: AdminSalesSeries['points'][number]): string {
  // Titik per jam berlabel 'HH:00'; titik per hari berlabel 'YYYY-MM-DD'.
  return point.date.length > 5
    ? `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`
    : point.date
}

export const Route = createFileRoute('/admin/')({
  loader: async ({ context }) => {
    const range = rangeForPeriod('30d', '', '')
    await Promise.all([
      context.queryClient.ensureQueryData(adminOverviewOptions),
      context.queryClient.ensureQueryData(
        adminSalesOptions(range.from, range.to),
      ),
    ])
  },
  component: OverviewPage,
  // Kerangka dashboard tampil seketika saat pindah dari halaman login; data KPI
  // menyusul tanpa menahan seluruh halaman (dulu UI kosong ±1 detik).
  pendingComponent: OverviewSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
})

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  attention = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  attention?: boolean
}) {
  return (
    <div
      className={
        attention
          ? 'card admin-kpi-card admin-kpi-card--attention'
          : 'card admin-kpi-card'
      }
    >
      <div className="card__body">
        <div className="admin-kpi-card__head">
          <span className="icon-box icon-box--sm">
            <Icon aria-hidden="true" />
          </span>
          <span className="admin-kpi-card__label">{label}</span>
        </div>
        <div>
          <div className="admin-kpi-card__value">{value}</div>
          {hint ? <div className="admin-kpi-card__hint">{hint}</div> : null}
        </div>
      </div>
    </div>
  )
}

function OverviewPage() {
  const { data } = useQuery(adminOverviewOptions)
  const { data: me } = useQuery(meOptions)
  const [period, setPeriod] = useState<PeriodId>('30d')
  const [customFrom, setCustomFrom] = useState(() => daysAgo(29))
  const [customTo, setCustomTo] = useState(() => ymdOf(new Date()))

  const range = useMemo(
    () => rangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  )
  const salesQuery = useQuery(adminSalesOptions(range.from, range.to))
  const sales = salesQuery.data

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!sales || !canvasRef.current) return
    // Tick sumbu-x disesuaikan lebar canvas: di layar sempit label tanggal
    // dipaksa muat (dulu: "03/1007/1011/10…" menumpuk jadi tidak terbaca).
    // Ukur dari container .admin-chart: clientWidth canvas sendiri masih 300
    // (default bawaan) sebelum Chart.js menginisialisasi.
    const canvasWidth =
      canvasRef.current.parentElement?.clientWidth ??
      canvasRef.current.clientWidth
    const xTickFont = { size: canvasWidth < 360 ? 10 : 12 }
    const maxXTicks = Math.min(8, Math.max(3, Math.floor(canvasWidth / 68)))
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: sales.points.map(chartLabelOf),
        datasets: [
          {
            label: 'Omzet (Rp)',
            data: sales.points.map((s) => s.total),
            borderColor: '#0a0a0a',
            backgroundColor: 'rgba(10, 10, 10, 0.05)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#0a0a0a',
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a0a0a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => rupiah(Number(context.parsed.y)),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: '#e7e9ee' },
            ticks: {
              color: '#6f7680',
              maxTicksLimit: maxXTicks,
              autoSkip: true,
              maxRotation: 0,
              font: xTickFont,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => rupiah(Number(v)),
              color: '#6f7680',
              maxTicksLimit: 6,
            },
            grid: { color: '#eef0f3' },
            border: { display: false },
          },
        },
      },
    })
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [sales])

  if (!data) return null

  const fullName = me?.name ?? 'Admin'
  const periodTitle =
    period === 'today'
      ? 'Pendapatan hari ini'
      : period === '7d'
        ? 'Pendapatan 7 hari'
        : period === '30d'
          ? 'Pendapatan 30 hari'
          : `Pendapatan ${formatDate(range.from)} – ${formatDate(range.to)}`

  return (
    <AdminPage
      title={`Halo, ${fullName}`}
      description="Ringkasan operasional Tiba Tiba Camping hari ini."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Coins}
          label="Omzet hari ini"
          value={rupiah(data.todayRevenue)}
          hint="Tanpa deposit sewa"
        />
        <KpiCard
          icon={Wallet}
          label="Omzet bulan ini"
          value={rupiah(data.monthRevenue)}
          hint="Tanpa deposit sewa"
        />
        <KpiCard
          icon={ReceiptText}
          label="Order bulan ini"
          value={String(data.monthOrders)}
          hint="Semua tipe order"
        />
        <KpiCard
          icon={Tent}
          label="Sewa aktif"
          value={String(data.activeRentals)}
          hint="Sedang berjalan"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
        <div className="grid grid-cols-1 gap-3 xl:col-span-8">
          <AdminCard
            title={periodTitle}
            actions={
              <>
                <span className="admin-panel-meta">
                  {salesQuery.isLoading
                    ? 'Memuat…'
                    : `Total ${rupiah(sales?.total ?? 0)}`}
                </span>
                <div
                  className="toggle-group toggle-group--sm"
                  role="group"
                  aria-label="Periode pendapatan"
                >
                  {PERIODS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="toggle"
                      aria-pressed={period === option.id}
                      onClick={() => setPeriod(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            }
          >
            {period === 'custom' ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  Dari
                  <input
                    type="date"
                    className="input input--sm"
                    value={customFrom}
                    max={customTo}
                    onChange={(event) => setCustomFrom(event.target.value)}
                  />
                </label>
                <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  Sampai
                  <input
                    type="date"
                    className="input input--sm"
                    value={customTo}
                    min={customFrom}
                    onChange={(event) => setCustomTo(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            <div className="admin-chart">
              <canvas ref={canvasRef} />
            </div>
          </AdminCard>

          <AdminCard
            title="Order terbaru"
            actions={
              <Link
                to="/admin/transaksi"
                className={buttonClass({ variant: 'ghost', size: 'sm' })}
              >
                Lihat semua
              </Link>
            }
            bodyClassName="p-0"
          >
            {data.latestOrders.length === 0 ? (
              <div className="px-4 py-6">
                <EmptyState
                  size="sm"
                  icon={ReceiptText}
                  title="Belum ada order"
                  text="Order baru akan tampil di sini."
                />
              </div>
            ) : (
              <AdminTable
                head={
                  <>
                    <th scope="col">Kode</th>
                    <th scope="col">Pelanggan</th>
                    {/* Tipe rela dikorbankan di layar sempit: sel Status/Total
                        muat penuh dalam kartu (dulu badge "Sedang Disewa"
                        terpotong keluar tepi kartu). */}
                    <th scope="col" className="hidden md:table-cell">
                      Tipe
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Total
                    </th>
                  </>
                }
              >
                {data.latestOrders.map((order) => (
                  <tr key={order.id}>
                    <th scope="row">
                      <Link
                        to="/admin/transaksi/$id"
                        params={{ id: order.id }}
                        className="link font-medium"
                      >
                        {order.code}
                      </Link>
                    </th>
                    <td>{customerLabel(order.customer, order.customerName)}</td>
                    <td className="hidden md:table-cell">
                      {ORDER_TYPE_LABEL[order.type] ?? order.type}
                    </td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="whitespace-nowrap text-right font-semibold">
                      {rupiah(order.grandTotal)}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:col-span-4">
          <AdminCard
            title="Perlu perhatian"
            bodyClassName="py-1"
            footer={
              <Link
                to="/admin/produk"
                className={buttonClass({
                  variant: 'ghost',
                  size: 'sm',
                  block: true,
                })}
              >
                Kelola inventori
              </Link>
            }
          >
            <ul className="admin-list">
              <li className="admin-list__row">
                <PackageOpen
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="admin-list__label">PO menunggu</span>
                <span className="admin-list__value">
                  {data.pendingPreorders}
                </span>
              </li>
              <li className="admin-list__row">
                <TriangleAlert
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="admin-list__label">Stok menipis</span>
                <span
                  className={
                    data.lowStock > 0
                      ? 'admin-list__value admin-list__value--attention'
                      : 'admin-list__value'
                  }
                >
                  {data.lowStock}
                </span>
              </li>
            </ul>
          </AdminCard>

          <AdminCard
            title="Produk terlaris"
            actions={<span className="admin-panel-meta">30 hari</span>}
            bodyClassName="py-1"
          >
            {data.topProducts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={ReceiptText}
                title="Belum ada penjualan"
                text="Produk terlaris muncul setelah ada order."
              />
            ) : (
              <ol className="admin-rank">
                {data.topProducts.map((product, index) => (
                  <li key={product.name} className="admin-rank__row">
                    <span className="admin-rank__index">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="admin-rank__name">{product.name}</span>
                      <span className="admin-rank__meta block">
                        {product.qty} terjual
                      </span>
                    </span>
                    <span className="admin-rank__value">
                      {rupiah(product.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  )
}

/**
 * Kerangka overview selama query berjalan. Struktur & tinggi kartu dibuat mirip
 * konten asli supaya peralihan ke data tidak menggeser layout.
 */
function OverviewSkeleton() {
  const { data: me } = useQuery(meOptions)
  const fullName = me?.name ?? 'Admin'

  return (
    <AdminPage
      title={`Halo, ${fullName}`}
      description="Ringkasan operasional Tiba Tiba Camping hari ini."
    >
      <p className="sr-only" role="status">
        Memuat ringkasan…
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card admin-kpi-card">
            <div className="card__body">
              <div className="flex items-center gap-2">
                <span className="size-8 animate-pulse rounded-full bg-border" />
                <span className="h-3 w-24 animate-pulse rounded bg-border" />
              </div>
              <div>
                <div className="h-7 w-28 animate-pulse rounded bg-border" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-border" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-1 items-start gap-3 xl:grid-cols-12"
        aria-hidden="true"
      >
        <div className="grid grid-cols-1 gap-3 xl:col-span-8">
          <AdminCard
            title="Pendapatan 30 hari"
            actions={
              <div className="toggle-group toggle-group--sm" aria-hidden="true">
                {PERIODS.map((option) => (
                  <span key={option.id} className="toggle">
                    {option.label}
                  </span>
                ))}
              </div>
            }
          >
            <div className="admin-chart">
              <div className="size-full min-h-[220px] animate-pulse rounded bg-border/60" />
            </div>
          </AdminCard>

          <AdminCard title="Order terbaru">
            <div className="flex flex-col gap-3 py-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded bg-border/60"
                />
              ))}
            </div>
          </AdminCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:col-span-4">
          <AdminCard title="Perlu perhatian" bodyClassName="py-1">
            <div className="flex flex-col gap-3 py-2">
              <div className="h-5 animate-pulse rounded bg-border/60" />
              <div className="h-5 animate-pulse rounded bg-border/60" />
            </div>
          </AdminCard>

          <AdminCard title="Produk terlaris" bodyClassName="py-1">
            <div className="flex flex-col gap-3 py-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-6 animate-pulse rounded bg-border/60"
                />
              ))}
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  )
}
