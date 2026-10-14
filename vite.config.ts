import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// ponytail: script-src masih 'unsafe-inline' (SSR state payload TanStack) —
// upgrade path: nonce per-request bila butuh CSP ketat.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.sandbox.midtrans.com https://app.midtrans.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: https://app.sandbox.midtrans.com https://app.midtrans.com https://api.midtrans.com",
    "frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: { '/**': { headers: securityHeaders } },
    }),
    tailwindcss(),
    tanstackStart({
      // Modul server-only tidak boleh dieksekusi di browser: diganti mock
      // proxy (dev & build). Tanpa ini, import `postgres`/better-auth di
      // module graph client melempar `Buffer is not defined` dan hydration gagal.
      importProtection: {
        behavior: 'mock',
        mockAccess: 'off',
        client: {
          // files menggantikan default, jadi pola default ikut ditulis ulang
          files: ['**/*.server.*', 'src/server/db/index.*', 'src/lib/auth.*'],
        },
      },
    }),
    viteReact(),
  ],
})

export default config
