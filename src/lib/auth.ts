import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '#/lib/env'
import { db } from '#/server/db'
import * as schema from '#/server/db/schema'

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.APP_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'customer', input: false },
      phone: { type: 'string', required: false },
      isActive: { type: 'boolean', defaultValue: true, input: false },
    },
  },
  advanced: {
    database: { generateId: 'uuid' as const },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  plugins: [tanstackStartCookies()],
})
