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

/** Batas panjang SKU varian (sinkron dengan `saveVariantSchema` di server/fn/admin). */
export const VARIANT_SKU_MAX = 64

/**
 * Gabungkan slug + sufiks menjadi SKU yang selalu muat di batas skema.
 * Slug dipotong dari belakang (tanpa tanda `-` menggantung) agar sufiks tetap utuh.
 */
export function variantSku(slug: string, suffix: string): string {
  const maxSlug = VARIANT_SKU_MAX - suffix.length - 1
  let head = slug.length > maxSlug ? slug.slice(0, Math.max(0, maxSlug)) : slug
  if (head.endsWith('-')) head = head.slice(0, -1)
  return `${head}-${suffix}`
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

const ZOD_ISSUE_FIELDS: Record<string, string> = {
  sku: 'SKU',
  salePriceOverride: 'harga override',
  salePrice: 'harga jual',
  rentPricePerDay: 'harga sewa per hari',
  name: 'nama produk',
  brandLine: 'merek',
  description: 'deskripsi',
  stock: 'stok',
  colorName: 'warna',
  colorHex: 'kode hex warna',
  size: 'ukuran',
  discountPercent: 'diskon',
}

function zodIssueText(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const issue = raw as {
    origin?: unknown
    code?: unknown
    path?: unknown
    maximum?: unknown
    minimum?: unknown
  }
  const field = Array.isArray(issue.path)
    ? ZOD_ISSUE_FIELDS[String(issue.path[0])]
    : undefined
  if (!field) return undefined
  if (issue.code === 'too_big' && typeof issue.maximum === 'number') {
    return `${field} maksimal ${issue.maximum} karakter`
  }
  if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
    return issue.origin === 'string'
      ? `${field} minimal ${issue.minimum} karakter`
      : `${field} harus lebih dari ${issue.minimum}`
  }
  return `Isi ${field} dengan benar.`
}

/**
 * Ubah pesan error server jadi kalimat manusia.
 * Validasi Zod datang sebagai deretan isu yang di-JSON — itu yang sering muncul mentah di toast.
 */
export function errorText(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const readable = parsed
          .map(zodIssueText)
          .filter((t): t is string => Boolean(t))
          .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        if (readable.length > 0) return `${readable.join('. ')}.`
      }
    } catch {
      // Bukan JSON valid — jatuh ke tampilan mentah di bawah.
    }
  }
  return raw || fallback
}
