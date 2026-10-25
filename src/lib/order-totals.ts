export function rentalDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

/** Deposit sewa = 50% dari total sewa, dibulatkan ke rupiah terdekat. */
export function rentalDeposit(rentSubtotal: number): number {
  return Math.max(0, Math.round(rentSubtotal * 0.5))
}

export function rentTotals(args: { rentPerDay: number; days: number; qty: number }) {
  const rentTotal = args.rentPerDay * args.days * args.qty
  const depositTotal = rentalDeposit(rentTotal)
  return { rentTotal, depositTotal, grandTotal: rentTotal + depositTotal }
}

/** Tanggal kalender WIB dalam bentuk `YYYY-MM-DD`. */
function jakartaDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Selisih hari kalender WIB menuju tenggat. `0` berarti hari ini masih
 * tenggat, negatif berarti sudah lewat.
 */
export function daysUntilDeadline(deadline: Date, now = new Date()): number {
  const due = Date.parse(`${jakartaDateKey(deadline)}T00:00:00Z`)
  const today = Date.parse(`${jakartaDateKey(now)}T00:00:00Z`)
  return Math.round((due - today) / 86_400_000)
}

export type RentalDeadlineInfo = {
  deadline: Date | null
  daysLeft: number | null
  lateDays: number
}

/** Tenggat order sewa = `rentEnd` paling akhir dari item-itemnya. */
export function rentalDeadlineInfo(
  rentEnds: Array<Date | string | null | undefined>,
  now = new Date(),
): RentalDeadlineInfo {
  let deadline: Date | null = null
  for (const value of rentEnds) {
    if (!value) continue
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) continue
    if (!deadline || date.getTime() > deadline.getTime()) deadline = date
  }
  if (!deadline) return { deadline: null, daysLeft: null, lateDays: 0 }
  const daysLeft = daysUntilDeadline(deadline, now)
  return { deadline, daysLeft, lateDays: Math.max(0, -daysLeft) }
}

export function preorderDpAmount(subtotal: number, dpPercent: number | null): number {
  if (!dpPercent || dpPercent <= 0 || dpPercent > 100) return subtotal
  return Math.round((subtotal * dpPercent) / 100)
}
