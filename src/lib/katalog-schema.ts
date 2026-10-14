import { z } from 'zod'

export const transactionModes = ['beli', 'sewa', 'preorder'] as const
export type TransactionMode = (typeof transactionModes)[number]

/**
 * State filter katalog disimpan sebagai search params URL (shareable).
 * Field bertipe list disimpan sebagai CSV ("tenda,kompor").
 */
/** Router men-parse nilai search sebagai JSON, jadi `diskon=1` sampai sebagai number 1. */
const flagSchema = z
  .union([z.literal('1'), z.literal(1)])
  .transform(() => 1 as const)

export const katalogSearchSchema = z.object({
  q: z.coerce.string().trim().max(100).optional(),
  kategori: z.string().optional(),
  tipe: z.string().optional(),
  harga_min: z.coerce.number().int().min(0).optional(),
  harga_max: z.coerce.number().int().min(0).optional(),
  kapasitas: z.string().optional(),
  musim: z.string().optional(),
  bahan: z.string().optional(),
  warna: z.string().optional(),
  berat_max: z.coerce.number().min(0).optional(),
  tersedia: flagSchema.optional(), // 1 (dinormalisasi dari "1")
  diskon: flagSchema.optional(),
  sort: z.enum(['terbaru', 'harga-naik', 'harga-turun', 'relevan']).default('terbaru'),
  halaman: z.coerce.number().int().min(1).default(1),
})

export type KatalogSearch = z.infer<typeof katalogSearchSchema>

export function splitCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const parts = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return parts.length ? parts : undefined
}

export function toggleCsv(current: string | undefined, value: string): string | undefined {
  const list = splitCsv(current) ?? []
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  return next.length ? next.join(',') : undefined
}

export const KATALOG_PAGE_SIZE = 12
