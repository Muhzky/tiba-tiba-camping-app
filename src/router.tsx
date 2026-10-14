import { QueryClient } from '@tanstack/react-query'
import {
  createRouter as createTanStackRouter,
  Link,
} from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

function NotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '3rem 1rem',
        gap: '0.5rem',
      }}
    >
      <p style={{ fontSize: '3rem', fontWeight: 600, margin: 0 }}>404</p>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
        Halaman tidak ditemukan
      </h1>
      <p style={{ color: '#6B7280', margin: 0 }}>
        Halaman yang kamu cari tidak ada atau sudah dipindahkan.
      </p>
      <Link
        to="/"
        style={{
          marginTop: '1rem',
          display: 'inline-block',
          padding: '0.625rem 1.5rem',
          borderRadius: '9999px',
          background: '#000000',
          color: '#FFFFFF',
          fontSize: '0.875rem',
          textDecoration: 'none',
        }}
      >
        Kembali ke beranda
      </Link>
    </div>
  )
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  })

  // Inline script TSR sudah restore scroll sebelum hydration; render pertama
  // setelah hydration jangan restore ulang — itu yang nge-scroll ke top saat
  // user sudah scroll di tengah hydration.
  let initialRender = true

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: () => {
      if (initialRender) {
        initialRender = false
        return false
      }
      return true
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

export interface RouterContext {
  queryClient: QueryClient
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
