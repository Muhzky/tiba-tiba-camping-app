import { describe, expect, it } from 'vitest'
import { orderStatusTone, ORDER_STATUS_LABEL } from './order-status'
import { preorderDpAmount, rentalDays, rentalDeadlineInfo, rentalDeposit, rentTotals, daysUntilDeadline } from './order-totals'

describe('rentalDays', () => {
  it('membulatkan ke atas, minimum 1 hari', () => {
    expect(rentalDays(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z'))).toBe(1)
    expect(rentalDays(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z'))).toBe(2)
    expect(rentalDays(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-02T09:00:00Z'))).toBe(1)
    expect(rentalDays(new Date('2026-01-05T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toBe(1)
  })
})

describe('rentTotals', () => {
  it('harga sewa = per hari × hari × qty, deposit 50% dari total sewa', () => {
    const t = rentTotals({ rentPerDay: 75_000, days: 3, qty: 2 })
    expect(t.rentTotal).toBe(450_000)
    expect(t.depositTotal).toBe(225_000)
    expect(t.grandTotal).toBe(675_000)
  })
})

describe('rentalDeposit', () => {
  it('selalu 50% dan dibulatkan ke rupiah terdekat', () => {
    expect(rentalDeposit(450_000)).toBe(225_000)
    expect(rentalDeposit(75_001)).toBe(37_501)
    expect(rentalDeposit(0)).toBe(0)
    expect(rentalDeposit(-10)).toBe(0)
  })
})

describe('tenggat sewa', () => {
  const deadline = new Date('2026-10-27T00:00:00+07:00')

  it('menghitung sisa hari kalender WIB', () => {
    expect(daysUntilDeadline(deadline, new Date('2026-10-25T12:00:00+07:00'))).toBe(2)
    expect(daysUntilDeadline(deadline, new Date('2026-10-27T23:59:00+07:00'))).toBe(0)
  })

  it('menghitung keterlambatan setelah tenggat', () => {
    const info = rentalDeadlineInfo([deadline], new Date('2026-10-28T00:01:00+07:00'))
    expect(info.daysLeft).toBe(-1)
    expect(info.lateDays).toBe(1)
  })

  it('memakai rentEnd paling akhir dan mengabaikan nilai kosong', () => {
    const earlier = new Date('2026-10-26T00:00:00+07:00')
    const info = rentalDeadlineInfo([null, earlier, deadline], new Date('2026-10-25T12:00:00+07:00'))
    expect(info.deadline?.toISOString()).toBe(deadline.toISOString())
    expect(info.daysLeft).toBe(2)
  })

  it('tanpa tanggal sewa → tanpa tenggat', () => {
    expect(rentalDeadlineInfo([null, undefined])).toEqual({
      deadline: null,
      daysLeft: null,
      lateDays: 0,
    })
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
