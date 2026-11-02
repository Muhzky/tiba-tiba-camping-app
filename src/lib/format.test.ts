import { describe, expect, it } from 'vitest'
import { errorText, slugify, variantSku } from './format'

describe('variantSku', () => {
  it('menggabungkan slug pendek dengan sufiks tanpa dipotong', () => {
    expect(variantSku('tenda-ultralight', 'default')).toBe(
      'tenda-ultralight-default',
    )
  })

  it('memotong slug panjang agar SKU tetap muat di batas 64 karakter', () => {
    const slug = slugify(
      'ALLTREK Tenda Otomatis PEAK VILLA Camping Glamping Luxury Double Layer',
    )
    const sku = variantSku(slug, 'default')
    expect(sku.length).toBeLessThanOrEqual(64)
    expect(sku.endsWith('-default')).toBe(true)
  })

  it('tidak meninggalkan tanda hubung menggantung di batas potong', () => {
    // Slug 56 karakter persis, karakter ke-56 adalah '-' → harus dibuang.
    const slug = 'a'.repeat(55) + '-'
    const sku = variantSku(slug, 'default')
    expect(sku).toBe(`${'a'.repeat(55)}-default`)
    expect(sku.length).toBeLessThanOrEqual(64)
  })

  it('menangani sufiks panjang tanpa melampaui batas', () => {
    const sku = variantSku('x'.repeat(100), 'a'.repeat(63))
    expect(sku).toBe(`-${'a'.repeat(63)}`)
    expect(sku.length).toBeLessThanOrEqual(64)
  })
})

describe('errorText', () => {
  const zodJson = JSON.stringify([
    {
      origin: 'string',
      code: 'too_big',
      maximum: 64,
      inclusive: true,
      path: ['sku'],
      message: 'Too big: expected string to have <=64 characters',
    },
    {
      origin: 'number',
      code: 'too_small',
      minimum: 0,
      inclusive: false,
      path: ['salePriceOverride'],
      message: 'Too small: expected number to be >0',
    },
  ])

  it('menerjemahkan deretan isu Zod menjadi kalimat manusia', () => {
    expect(errorText(new Error(zodJson), 'Gagal.')).toBe(
      'SKU maksimal 64 karakter. Harga override harus lebih dari 0.',
    )
  })

  it('meneruskan pesan error biasa apa adanya', () => {
    expect(errorText(new Error('PRODUK_TIDAK_DITEMUKAN'), 'Gagal.')).toBe(
      'PRODUK_TIDAK_DITEMUKAN',
    )
  })

  it('memakai fallback ketika tidak ada pesan', () => {
    expect(errorText(undefined, 'Gagal menyimpan.')).toBe('Gagal menyimpan.')
  })

  it('meneruskan teks mentah yang diawali [ tetapi bukan JSON valid', () => {
    expect(errorText(new Error('[bukan json'), 'Gagal.')).toBe('[bukan json')
  })
})
