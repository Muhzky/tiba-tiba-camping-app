import { createServerFn } from '@tanstack/react-start'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { env } from '#/lib/env'
import { slugify } from '#/lib/format'
import { requireAdmin } from '#/server/fn/admin'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const

export const r2UploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.int().positive().max(MAX_IMAGE_BYTES),
})

export type R2UploadRequest = z.infer<typeof r2UploadSchema>

export const getR2UploadUrl = createServerFn({ method: 'POST' })
  .validator((input: R2UploadRequest) => r2UploadSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin()
    const ext = data.contentType === 'image/webp' ? 'webp' : data.contentType === 'image/png' ? 'png' : 'jpg'
    const key = `products/${crypto.randomUUID()}-${slugify(data.fileName.replace(/\.[^.]+$/, ''))}.${ext}`

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
  })
