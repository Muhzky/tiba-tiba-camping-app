import { createFileRoute, Outlet } from '@tanstack/react-router'
import appCss from '../../styles.css?url'
import { Navbar } from '#/components/site/Navbar'
import { Footer } from '#/components/site/Footer'
import { Toaster } from '#/components/ui/sonner'
import { meOptions } from '#/server/fn/auth'
import { cartOptions } from '#/server/fn/cart'

export const Route = createFileRoute('/(public)')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(meOptions),
      context.queryClient.ensureQueryData(cartOptions),
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
