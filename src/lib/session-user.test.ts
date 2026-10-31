import { describe, expect, it } from 'vitest'
import { toSessionUser } from './session-user'

const base = {
  id: 'u1',
  name: 'Admin',
  email: 'admin@example.test',
}

describe('toSessionUser', () => {
  it('memetakan user Better Auth ke SessionUser', () => {
    expect(
      toSessionUser({
        ...base,
        phone: '0812',
        image: null,
        role: 'admin',
        isActive: true,
      }),
    ).toEqual({
      id: 'u1',
      name: 'Admin',
      email: 'admin@example.test',
      phone: '0812',
      image: null,
      role: 'admin',
      isActive: true,
    })
  })

  it('default role customer dan field opsional null', () => {
    expect(toSessionUser(base)).toEqual({
      ...base,
      phone: null,
      image: null,
      role: 'customer',
      isActive: true,
    })
  })

  it('akun nonaktif tidak dianggap login', () => {
    expect(toSessionUser({ ...base, isActive: false })).toBeNull()
  })
})
