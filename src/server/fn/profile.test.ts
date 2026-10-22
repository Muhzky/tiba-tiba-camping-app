import { describe, expect, it } from 'vitest'
import { MAX_PROFILE_IMAGE_LENGTH, profileSchema } from '#/server/fn/account'

const jpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ=='

describe('profileSchema', () => {
  it('accepts https, relative and inline image sources', () => {
    for (const image of [
      'https://cdn.example.com/avatar.jpg',
      '/images/avatar.png',
      jpegDataUrl,
    ]) {
      const parsed = profileSchema.parse({
        name: 'Budi',
        phone: '081234567890',
        image,
      })
      expect(parsed.image).toBe(image)
    }
  })

  it('rejects unsafe or unsupported image sources', () => {
    for (const image of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
    ]) {
      expect(() =>
        profileSchema.parse({ name: 'Budi', phone: '', image }),
      ).toThrow()
    }
  })

  it('rejects inline images above the size budget', () => {
    const oversized = `data:image/jpeg;base64,${'A'.repeat(MAX_PROFILE_IMAGE_LENGTH)}`
    expect(() =>
      profileSchema.parse({ name: 'Budi', phone: '', image: oversized }),
    ).toThrow()
  })

  it('normalizes blank optional fields to null', () => {
    const parsed = profileSchema.parse({ name: ' Budi ', phone: '', image: '' })
    expect(parsed).toEqual({ name: 'Budi', phone: null, image: null })
  })
})
