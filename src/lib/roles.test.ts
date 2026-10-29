import { describe, expect, it } from 'vitest'
import { isAdminModeError, isStaffRole } from './roles'

describe('isStaffRole', () => {
  it('hanya admin dan owner yang dianggap staff', () => {
    expect(isStaffRole('admin')).toBe(true)
    expect(isStaffRole('owner')).toBe(true)
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
