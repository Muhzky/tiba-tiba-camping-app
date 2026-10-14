import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '#/server/db'
import { newsletterSubscribers } from '#/server/db/schema'

export const newsletterSchema = z.object({
  email: z.string().email('Masukkan email yang valid'),
})
export type NewsletterInput = z.infer<typeof newsletterSchema>

export const subscribeNewsletter = createServerFn({ method: 'POST' })
  .validator(newsletterSchema)
  .handler(async ({ data }) => {
    await db
      .insert(newsletterSubscribers)
      .values({ email: data.email.toLowerCase() })
      .onConflictDoNothing()
    return { ok: true as const }
  })
