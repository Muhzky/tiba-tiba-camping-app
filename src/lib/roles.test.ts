import { describe, expect, it } from 'vitest'
import { isAdminModeError, isStaffRole, postLoginTarget } from './roles'

describe('isStaffRole', () => {
  it('hanya admin yang dianggap staff', () => {
    expect(isStaffRole('admin')).toBe(true)
    expect(isStaffRole('customer')).toBe(false)
    expect(isStaffRole(null)).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
  })
})

describe('isAdminModeError', () => {
  it('mendeteksi error ADMIN_MODE dari server function', () => {
    expect(isAdminModeError(new Error('ADMIN_MODE'))).toBe(true)
    expect(isAdminModeError(new Error('Gagal: ADMIN_MODE terdeteksi'))).toBe(
      true,
    )
    expect(isAdminModeError(new Error('STOK_KURANG'))).toBe(false)
    expect(isAdminModeError('ADMIN_MODE')).toBe(false)
    expect(isAdminModeError(null)).toBe(false)
  })
})

describe('postLoginTarget', () => {
  it('staff selalu ke /admin, mengabaikan redirect halaman pelanggan', () => {
    expect(postLoginTarget('admin')).toBe('/admin')
    expect(postLoginTarget('admin', '/akun')).toBe('/admin')
    expect(postLoginTarget('admin', '/akun/pesanan')).toBe('/admin')
    expect(postLoginTarget('admin', '/keranjang')).toBe('/admin')
  })

  it('staff tetap menghormati deep link di area /admin', () => {
    expect(postLoginTarget('admin', '/admin/pos')).toBe('/admin/pos')
    expect(postLoginTarget('admin', '/admin/pesanan?status=baru')).toBe(
      '/admin/pesanan?status=baru',
    )
  })

  it('customer memakai redirect bila ada, selain itu /akun', () => {
    expect(postLoginTarget('customer')).toBe('/akun')
    expect(postLoginTarget('customer', '/checkout')).toBe('/checkout')
    expect(postLoginTarget(null)).toBe('/akun')
    expect(postLoginTarget(undefined)).toBe('/akun')
  })
})
