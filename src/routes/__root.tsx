import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { RouterContext } from '../router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'Tiba Tiba Camping — Outdoor gear & sewa alat camping',
      },
      {
        name: 'description',
        content:
          'Outdoor gear — rencana boleh dadakan, gear harus matang. Jual, sewa, dan pre-order perlengkapan camping resmi.',
      },
      { property: 'og:title', content: 'Tiba Tiba Camping' },
      {
        property: 'og:description',
        content: 'Outdoor gear — rencana boleh dadakan, gear harus matang.',
      },
      { property: 'og:type', content: 'website' },
    ],
    links: [{ rel: 'icon', href: '/images/logo-ttc.png', type: 'image/png' }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
