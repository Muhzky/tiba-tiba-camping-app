export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Dibayar',
  processing: 'Diproses',
  shipped: 'Dikirim',
  ready_pickup: 'Siap Diambil',
  awaiting_stock: 'Menunggu Stok',
  rented: 'Sedang Disewa',
  returned: 'Dikembalikan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
  refunded: 'Dikembalikan Dana',
  overdue: 'Terlambat',
}

export type StatusTone = 'pending' | 'success' | 'info' | 'destructive'

export function orderStatusTone(status: string): StatusTone {
  switch (status) {
    case 'paid':
    case 'completed':
    case 'returned':
    case 'refunded':
      return 'success'
    case 'shipped':
    case 'processing':
    case 'ready_pickup':
    case 'rented':
      return 'info'
    case 'cancelled':
    case 'expired':
    case 'overdue':
      return 'destructive'
    default:
      return 'pending'
  }
}

export const ORDER_TYPE_LABEL: Record<string, string> = {
  buy: 'Beli',
  rent: 'Sewa',
  preorder: 'Pre-Order',
}
