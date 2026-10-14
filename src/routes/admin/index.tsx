import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Chart from 'chart.js/auto'
import { adminOverviewOptions } from '#/server/fn/admin'
import { rupiah } from '#/lib/format'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, orderStatusTone } from '#/lib/order-status'

export const Route = createFileRoute('/admin/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(adminOverviewOptions)
  },
  component: OverviewPage,
})

const TONE_CLASS: Record<string, string> = {
  pending: 'badge-light',
  success: 'badge-success',
  info: 'badge-info',
  destructive: 'badge-danger',
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="col-md-4 col-xl-2 mb-3">
      <div className="card">
        <div className="card-body">
          <div className="text-muted text-sm">{label}</div>
          <div className="d-flex align-items-center justify-content-between mt-1">
            <span className="font-weight-bold text-lg mb-0">{value}</span>
            <i className={`${icon} text-primary`} />
          </div>
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
        labels: data.sales30d.map((s) => s.date.slice(8) + '/' + s.date.slice(5, 7)),
        datasets: [
          {
            label: 'Omzet (Rp)',
            data: data.sales30d.map((s) => s.total),
            borderColor: '#457AA0',
            backgroundColor: 'rgba(69, 122, 160, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => rupiah(Number(v)) } },
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
    <>
      <div className="section-header">
        <h1>Overview</h1>
      </div>
      <div className="section-body">
        <div className="row">
          <StatCard label="Omzet hari ini" value={rupiah(data.todayRevenue)} icon="fas fa-coins" />
          <StatCard label="Omzet bulan ini" value={rupiah(data.monthRevenue)} icon="fas fa-wallet" />
          <StatCard label="Order bulan ini" value={String(data.monthOrders)} icon="fas fa-receipt" />
          <StatCard label="Sewa aktif" value={String(data.activeRentals)} icon="fas fa-campground" />
          <StatCard label="PO menunggu" value={String(data.pendingPreorders)} icon="fas fa-people-carry" />
          <StatCard label="Stok menipis" value={String(data.lowStock)} icon="fas fa-exclamation-triangle" />
        </div>

        <div className="row mt-3">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h4>Penjualan 30 hari</h4>
              </div>
              <div className="card-body">
                <canvas ref={canvasRef} height="80" />
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-3">
          <div className="col-lg-7">
            <div className="card">
              <div className="card-header">
                <h4>Order terbaru</h4>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Pelanggan</th>
                        <th>Tipe</th>
                        <th>Status</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.latestOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="font-weight-bold">{o.code}</td>
                          <td>{o.customer ?? 'Walk-in'}</td>
                          <td>{ORDER_TYPE_LABEL[o.type] ?? o.type}</td>
                          <td>
                            <span className={`badge ${TONE_CLASS[orderStatusTone(o.status)]}`}>
                              {ORDER_STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="text-right">{rupiah(o.grandTotal)}</td>
                        </tr>
                      ))}
                      {data.latestOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            Belum ada order
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="card">
              <div className="card-header">
                <h4>Produk terlaris (30 hari)</h4>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th className="text-right">Terjual</th>
                        <th className="text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.name}>
                          <td>{p.name}</td>
                          <td className="text-right">{p.qty}</td>
                          <td className="text-right">{rupiah(p.revenue)}</td>
                        </tr>
                      ))}
                      {data.topProducts.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center text-muted py-4">
                            Belum ada penjualan
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
