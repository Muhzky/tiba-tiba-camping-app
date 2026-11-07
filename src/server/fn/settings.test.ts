import { describe, expect, it } from 'vitest'
import { adminProfileSchema } from '#/server/fn/settings'

const base = {
  name: 'Admin TTC',
  email: 'admin@tibatibacamping.test',
  phone: '081234567890',
}

const jpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ=='

describe('adminProfileSchema', () => {
  it('accepts the same photo sources as the customer profile', () => {
    for (const image of [
      'https://cdn.example.com/avatar.jpg',
      '/images/avatar.png',
      jpegDataUrl,
    ]) {
      const parsed = adminProfileSchema.parse({ ...base, image })
      expect(parsed.image).toBe(image)
    }
  })

  it('rejects unsafe or unsupported photo sources', () => {
    for (const image of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
    ]) {
      expect(() => adminProfileSchema.parse({ ...base, image })).toThrow()
    }
  })

  it('normalizes a missing or blank photo to null', () => {
    expect(adminProfileSchema.parse(base).image).toBeNull()
    expect(adminProfileSchema.parse({ ...base, image: '' }).image).toBeNull()
  })
})
