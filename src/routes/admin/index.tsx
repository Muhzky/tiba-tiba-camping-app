import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
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
import { adminOverviewOptions } from '#/server/fn/admin'
import { rupiah } from '#/lib/format'
import { ORDER_TYPE_LABEL, customerLabel } from '#/lib/order-status'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { OrderStatusBadge } from '#/components/admin/badge'
import { EmptyState } from '#/components/admin/empty'
import { buttonClass } from '#/components/admin/button'

export const Route = createFileRoute('/admin/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(adminOverviewOptions)
  },
  component: OverviewPage,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!data || !canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: data.sales30d.map(
          (s) => s.date.slice(8) + '/' + s.date.slice(5, 7),
        ),
        datasets: [
          {
            label: 'Omzet (Rp)',
            data: data.sales30d.map((s) => s.total),
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
              maxTicksLimit: 8,
              autoSkip: true,
              maxRotation: 0,
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
  }, [data])

  if (!data) return null

  const revenue30d = data.sales30d.reduce((sum, day) => sum + day.total, 0)

  return (
    <AdminPage
      title="Overview"
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
            title="Penjualan 30 hari"
            actions={
              <span className="admin-panel-meta">
                Total {rupiah(revenue30d)}
              </span>
            }
          >
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
                    <th scope="col">Tipe</th>
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
                    <td>{ORDER_TYPE_LABEL[order.type] ?? order.type}</td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="text-right font-semibold">
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
