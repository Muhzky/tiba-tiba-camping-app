import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '#/server/fn/storage'
import type { AvatarUploadTarget, R2UploadRequest } from '#/server/fn/storage'

/** Sisi kotak (px) & kualitas JPEG hasil crop foto profil. */
export const AVATAR_SIZE = 320
export const AVATAR_QUALITY = 0.85

export type PreparedAvatar = {
  blob: Blob
  contentType: 'image/jpeg'
  fileName: string
  dataUrl: string
}

/** Server menolak nama berlebihan; potong supaya upload tidak gagal diam-diam. */
const MAX_FILE_NAME_CHARS = 80

function safeFileName(name: string): string {
  const chars = [...name].slice(0, MAX_FILE_NAME_CHARS).join('')
  return chars.replace(/[/\\]/g, '_') || 'avatar'
}

/** Pesan penolakan file (Bahasa Indonesia), atau null bila file diterima. */
export function avatarFileError(file: File): string | null {
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return 'Format foto harus JPG, PNG, atau WebP.'
  }
  if (file.size > MAX_IMAGE_BYTES) return 'Ukuran foto maksimal 5 MB.'
  return null
}

/**
 * Crop to a square, downscale and re-encode so avatars stay small enough to
 * upload to R2 — or, when storage isn't configured, to inline as a data URL.
 */
export async function prepareAvatar(
  file: File,
): Promise<PreparedAvatar | null> {
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      const context = canvas.getContext('2d')
      if (!context) return null
      const side = Math.min(bitmap.width, bitmap.height)
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      )
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', AVATAR_QUALITY)
      })
      if (!blob) return null
      const base = safeFileName(file.name.replace(/\.[^.]+$/, ''))
      return {
        blob,
        contentType: 'image/jpeg',
        fileName: `${base}.jpg`,
        dataUrl: canvas.toDataURL('image/jpeg', AVATAR_QUALITY),
      }
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}

export type AvatarUploadFn = (input: {
  data: R2UploadRequest
}) => Promise<AvatarUploadTarget>

/**
 * Presign → PUT ke R2, dengan fallback data URL inline bila storage belum
 * dikonfigurasi atau PUT-nya gagal. Melempar `UPLOAD_FAILED` bila foto tidak
 * bisa disiapkan sama sekali.
 */
export async function uploadProfileImage(
  file: File,
  upload: AvatarUploadFn,
): Promise<string> {
  const prepared = await prepareAvatar(file)
  const target = await upload({
    data: {
      fileName: prepared?.fileName ?? safeFileName(file.name),
      contentType:
        prepared?.contentType ??
        (file.type as (typeof ALLOWED_IMAGE_TYPES)[number]),
      size: prepared?.blob.size ?? file.size,
    },
  })

  if (target.mode === 'inline') {
    if (!prepared) throw new Error('UPLOAD_FAILED')
    return prepared.dataUrl
  }

  try {
    const response = await fetch(target.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': prepared?.contentType ?? file.type },
      body: prepared?.blob ?? file,
    })
    if (!response.ok) throw new Error('UPLOAD_FAILED')
    return target.publicUrl
  } catch {
    // Storage hiccup: keep the photo on the profile row instead of
    // dropping the user's change.
    if (!prepared) throw new Error('UPLOAD_FAILED')
    return prepared.dataUrl
  }
}
