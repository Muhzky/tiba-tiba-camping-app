export function rentalDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

export function rentTotals(args: {
  rentPerDay: number
  days: number
  qty: number
  deposit: number
}) {
  const rentTotal = args.rentPerDay * args.days * args.qty
  const depositTotal = args.deposit * args.qty
  return { rentTotal, depositTotal, grandTotal: rentTotal + depositTotal }
}

export function preorderDpAmount(subtotal: number, dpPercent: number | null): number {
  if (!dpPercent || dpPercent <= 0 || dpPercent > 100) return subtotal
  return Math.round((subtotal * dpPercent) / 100)
}
