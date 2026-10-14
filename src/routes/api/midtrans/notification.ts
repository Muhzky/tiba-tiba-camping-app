import { createFileRoute } from '@tanstack/react-router'
import type { MidtransNotification } from '#/server/fn/midtrans'
import { processMidtransNotification } from '#/server/fn/midtrans'

export const Route = createFileRoute('/api/midtrans/notification')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: MidtransNotification
        try {
          body = (await request.json()) as MidtransNotification
        } catch {
          return Response.json({ error: 'invalid json' }, { status: 400 })
        }
        const result = await processMidtransNotification(body)
        if (result.status >= 400) {
          return Response.json({ error: result.message }, { status: result.status })
        }
        return Response.json({ message: result.message }, { status: result.status })
      },
    },
  },
})
