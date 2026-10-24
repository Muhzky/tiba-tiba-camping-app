import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '#/lib/env'
import { db } from '#/server/db'
import * as schema from '#/server/db/schema'

// Saat dev lewat terowongan (ngrok), origin browser bukan APP_URL sehingga
// better-auth menolak request dengan INVALID_ORIGIN. Origin lokal & wildcard
// ngrok hanya didaftarkan di dev; build produksi tetap hanya APP_URL.
const isDev = process.env.NODE_ENV !== 'production'

const trustedOrigins = isDev
  ? [
      env.APP_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://*.ngrok-free.dev',
      'https://*.ngrok-free.app',
      'https://*.ngrok.io',
      'https://*.ngrok.app',
    ]
  : [env.APP_URL]

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.APP_URL,
  trustedOrigins,
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
