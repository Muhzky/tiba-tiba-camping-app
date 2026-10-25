export function rupiah(value: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(value))}`
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const jakartaDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  dateStyle: 'medium',
  timeStyle: 'short',
})

const jakartaDay = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  dateStyle: 'medium',
})

export function formatDateTime(value: Date | string): string {
  return jakartaDate.format(typeof value === 'string' ? new Date(value) : value)
}

/** Tanggal saja (tanpa jam), zona WIB. */
export function formatDate(value: Date | string): string {
  return jakartaDay.format(typeof value === 'string' ? new Date(value) : value)
}
