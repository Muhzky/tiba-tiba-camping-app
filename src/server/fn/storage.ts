import { createServerFn } from '@tanstack/react-start'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { env } from '#/lib/env'
import { slugify } from '#/lib/format'
import { requireAdmin } from '#/server/fn/admin'
import { getSessionUser } from '#/server/fn/auth'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const

export const r2UploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.int().positive().max(MAX_IMAGE_BYTES),
})

export type R2UploadRequest = z.infer<typeof r2UploadSchema>

/**
 * Local/dev `.env` ships placeholder R2 credentials, so presigning "works" but
 * every upload then fails at the network. Detect that up front and let callers
 * fall back to an inline (data URL) avatar stored on the user row.
 */
export function isR2Configured() {
  return !/placeholder/i.test(
    `${env.R2_ACCOUNT_ID} ${env.R2_PUBLIC_URL} ${env.R2_BUCKET}`,
  )
}

export type AvatarUploadTarget =
  | {
      mode: 'r2'
      uploadUrl: string
      key: string
      publicUrl: string
      expiresIn: number
    }
  | { mode: 'inline' }

function imageExtension(contentType: R2UploadRequest['contentType']) {
  return contentType === 'image/webp'
    ? 'webp'
    : contentType === 'image/png'
      ? 'png'
      : 'jpg'
}

async function presignImageUpload(data: R2UploadRequest, key: string) {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: data.contentType,
      ContentLength: data.size,
    }),
    { expiresIn: 600 },
  )

  return {
    uploadUrl,
    key,
    publicUrl: `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    expiresIn: 600,
  }
}

export const getR2UploadUrl = createServerFn({ method: 'POST' })
  .validator((input: R2UploadRequest) => r2UploadSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin()
    const key = `products/${crypto.randomUUID()}-${slugify(
      data.fileName.replace(/\.[^.]+$/, ''),
    )}.${imageExtension(data.contentType)}`
    return presignImageUpload(data, key)
  })

/** Presigned upload untuk foto profil. Hanya untuk user yang sudah masuk. */
export const getAvatarUploadUrl = createServerFn({ method: 'POST' })
  .validator((input: R2UploadRequest) => r2UploadSchema.parse(input))
  .handler(async ({ data }): Promise<AvatarUploadTarget> => {
    const user = await getSessionUser()
    if (!user) throw new Error('UNAUTHORIZED')
    if (!isR2Configured()) return { mode: 'inline' }
    const key = `avatars/${user.id}/${crypto.randomUUID()}.${imageExtension(
      data.contentType,
    )}`
    return { mode: 'r2', ...(await presignImageUpload(data, key)) }
  })
