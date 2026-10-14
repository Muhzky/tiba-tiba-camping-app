import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'
import { db } from '#/server/db'
import { products } from '#/server/db/schema'
import { env } from '#/lib/env'

const STATIC_PATHS = ['/', '/katalog', '/masuk', '/daftar']

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const rows = await db
          .select({ slug: products.slug, createdAt: products.createdAt })
          .from(products)
          .where(eq(products.isActive, true))
          .orderBy(desc(products.createdAt))

        const urls = [
          ...STATIC_PATHS.map((p) => ({ loc: `${env.APP_URL}${p}`, lastmod: null })),
          ...rows.map((r) => ({
            loc: `${env.APP_URL}/produk/${r.slug}`,
            lastmod: r.createdAt.toISOString().slice(0, 10),
          })),
        ]

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map((u) =>
            u.lastmod
              ? `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`
              : `  <url><loc>${u.loc}</loc></url>`,
          ),
          '</urlset>',
          '',
        ].join('\n')

        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        })
      },
    },
  },
})
