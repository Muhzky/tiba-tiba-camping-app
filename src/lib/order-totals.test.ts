import { describe, expect, it } from 'vitest'
import { orderStatusTone, ORDER_STATUS_LABEL } from './order-status'
import { preorderDpAmount, rentTotals, rentalDays } from './order-totals'

describe('rentalDays', () => {
  it('membulatkan ke atas, minimum 1 hari', () => {
    expect(rentalDays(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z'))).toBe(1)
    expect(rentalDays(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z'))).toBe(2)
    expect(rentalDays(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-02T09:00:00Z'))).toBe(1)
    expect(rentalDays(new Date('2026-01-05T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toBe(1)
  })
})

describe('rentTotals', () => {
  it('harga sewa = per hari × hari × qty, deposit dikembalikan terpisah', () => {
    const t = rentTotals({ rentPerDay: 75_000, days: 3, qty: 2, deposit: 100_000 })
    expect(t.rentTotal).toBe(450_000)
    expect(t.depositTotal).toBe(200_000)
    expect(t.grandTotal).toBe(650_000)
  })
})

describe('preorderDpAmount', () => {
  it('menghitung DP persen dan membulatkan', () => {
    expect(preorderDpAmount(1_000_000, 30)).toBe(300_000)
    expect(preorderDpAmount(333_333, 30)).toBe(100_000)
  })

  it('tanpa DP → bayar penuh', () => {
    expect(preorderDpAmount(500_000, null)).toBe(500_000)
    expect(preorderDpAmount(500_000, 0)).toBe(500_000)
    expect(preorderDpAmount(500_000, 150)).toBe(500_000)
  })
})

describe('order status', () => {
  it('label Indonesia terisi untuk semua status pakai', () => {
    for (const status of ['pending_payment', 'processing', 'rented', 'returned', 'awaiting_stock']) {
      expect(ORDER_STATUS_LABEL[status]).toBeTruthy()
    }
  })

  it('tone status konsisten', () => {
    expect(orderStatusTone('paid')).toBe('success')
    expect(orderStatusTone('cancelled')).toBe('destructive')
    expect(orderStatusTone('pending_payment')).toBe('pending')
    expect(orderStatusTone('rented')).toBe('info')
  })
})
