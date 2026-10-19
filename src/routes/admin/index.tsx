import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
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
import { ORDER_TYPE_LABEL } from '#/lib/order-status'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { StatCard } from '#/components/admin/stat'
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
        labels: data.sales30d.map((s) => s.date.slice(8) + '/' + s.date.slice(5, 7)),
        datasets: [
          {
            label: 'Omzet (Rp)',
            data: data.sales30d.map((s) => s.total),
            borderColor: '#0a0a0a',
            backgroundColor: 'rgba(10, 10, 10, 0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#0a0a0a',
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a0a0a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => rupiah(Number(context.parsed.y)),
            },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { color: '#e5e7eb' } },
          y: {
            ticks: { callback: (v) => rupiah(Number(v)), color: '#6b7280' },
            grid: { color: '#f3f4f6' },
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

  return (
    <AdminPage
      title="Overview"
      description="Ringkasan operasional Tiba Tiba Camping hari ini."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Omzet hari ini" value={rupiah(data.todayRevenue)} icon={Coins} />
        <StatCard label="Omzet bulan ini" value={rupiah(data.monthRevenue)} icon={Wallet} />
        <StatCard label="Order bulan ini" value={String(data.monthOrders)} icon={ReceiptText} />
        <StatCard label="Sewa aktif" value={String(data.activeRentals)} icon={Tent} />
        <StatCard label="PO menunggu" value={String(data.pendingPreorders)} icon={PackageOpen} />
        <StatCard
          label="Stok menipis"
          value={String(data.lowStock)}
          icon={TriangleAlert}
          tone={data.lowStock > 0 ? 'warning' : 'primary'}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AdminCard title="Penjualan 30 hari">
            <div className="admin-chart">
              <canvas ref={canvasRef} />
            </div>
          </AdminCard>
        </div>

        <div className="xl:col-span-4">
          <AdminCard title="Produk terlaris (30 hari)" bodyClassName="p-0">
            {data.topProducts.length === 0 ? (
              <div className="px-4 py-6">
                <EmptyState
                  size="sm"
                  icon={ReceiptText}
                  title="Belum ada penjualan"
                  text="Produk terlaris akan muncul di sini setelah ada order."
                />
              </div>
            ) : (
              <AdminTable
                head={
                  <>
                    <th scope="col">Produk</th>
                    <th scope="col" className="text-right">
                      Terjual
                    </th>
                    <th scope="col" className="text-right">
                      Omzet
                    </th>
                  </>
                }
              >
                {data.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="text-right font-medium">{p.qty}</td>
                    <td className="text-right font-semibold">{rupiah(p.revenue)}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminCard>
        </div>
      </div>

      <AdminCard
        title="Order terbaru"
        actions={
          <Link to="/admin/transaksi" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
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
            {data.latestOrders.map((o) => (
              <tr key={o.id}>
                <th scope="row">
                  <Link to="/admin/transaksi/$id" params={{ id: o.id }} className="link font-medium">
                    {o.code}
                  </Link>
                </th>
                <td>{o.customer ?? 'Walk-in'}</td>
                <td>{ORDER_TYPE_LABEL[o.type] ?? o.type}</td>
                <td>
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="text-right font-semibold">{rupiah(o.grandTotal)}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </AdminPage>
  )
}
