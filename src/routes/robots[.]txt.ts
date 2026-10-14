import { createFileRoute } from '@tanstack/react-router'
import { env } from '#/lib/env'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            'User-agent: *',
            'Disallow: /admin',
            'Disallow: /akun',
            'Disallow: /keranjang',
            'Disallow: /checkout',
            'Disallow: /api',
            `Sitemap: ${env.APP_URL}/sitemap.xml`,
            '',
          ].join('\n'),
          { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        ),
    },
  },
})
