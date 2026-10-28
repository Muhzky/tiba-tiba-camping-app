import { createFileRoute, Outlet } from '@tanstack/react-router'
import appCss from '../../styles.css?url'
import { Navbar } from '#/components/site/Navbar'
import { Footer } from '#/components/site/Footer'
import { Toaster } from '#/components/ui/sonner'
import { meOptions } from '#/server/fn/auth'
import { cartOptions } from '#/server/fn/cart'
import { siteSettingsOptions } from '#/server/fn/settings'

export const Route = createFileRoute('/(public)')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss, 'data-layout-style': 'public' }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(meOptions),
      context.queryClient.ensureQueryData(cartOptions),
      context.queryClient.ensureQueryData(siteSettingsOptions),
    ])
  },
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster position="bottom-right" />
    </div>
  )
}
