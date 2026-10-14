import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  APP_URL: z.string().url(),
  MIDTRANS_SERVER_KEY: z.string().min(1),
  MIDTRANS_CLIENT_KEY: z.string().min(1),
  MIDTRANS_IS_PRODUCTION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
})

type Env = z.infer<typeof EnvSchema>

// Nilai publik yang aman di bundler client (dari .env dengan prefix VITE_).
// Field rahasia sengaja dikosongkan — secret tidak pernah masuk client.
const clientEnv: Env = {
  DATABASE_URL: '',
  AUTH_SECRET: '',
  APP_URL: import.meta.env.VITE_APP_URL ?? '',
  MIDTRANS_SERVER_KEY: '',
  MIDTRANS_CLIENT_KEY: import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? '',
  MIDTRANS_IS_PRODUCTION: import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true',
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  R2_BUCKET: '',
  R2_PUBLIC_URL: import.meta.env.VITE_R2_PUBLIC_URL ?? '',
}

// Server-only: validated once at boot (nitro runtime). Browser: nilai publik.
// `document` lebih andal dari `process` — dev client punya polyfill `process`.
export const env: Env = typeof document === 'undefined' ? EnvSchema.parse(process.env) : clientEnv
