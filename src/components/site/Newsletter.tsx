import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { z } from 'zod'
import { subscribeNewsletter } from '#/server/fn/newsletter'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Reveal } from './Reveal'

const emailFieldSchema = z.email('Masukkan email yang valid')

export function Newsletter() {
  const subscribe = useServerFn(subscribeNewsletter)

  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      await subscribe({ data: value })
      toast.success('Terima kasih! Kamu sudah berlangganan newsletter kami.')
      form.reset()
    },
  })

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
      <Reveal>
        <div className="flex flex-col items-center gap-6 rounded-[28px] bg-surface px-6 py-14 text-center md:px-16">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Dapat kabar gear terbaru
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Restock, pre-order, dan promo sewa — langsung ke inbox-mu.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
            className="flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          >
            <form.Field
              name="email"
              validators={{ onSubmit: emailFieldSchema }}
              children={(field) => {
                const errors = field.state.meta.errors
                return (
                  <div className="flex-1">
                    <Input
                      type="email"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="nama@email.com"
                      aria-label="Alamat email"
                      aria-invalid={errors.length > 0 || undefined}
                      className="h-11 rounded-full bg-background px-5"
                    />
                    {errors.length > 0 ? (
                      <p role="alert" className="mt-1.5 px-2 text-left text-xs text-sale">
                        {errors.map(String).join(', ')}
                      </p>
                    ) : null}
                  </div>
                )
              }}
            />
            <Button
              type="submit"
              className="h-11 shrink-0 rounded-full px-6 font-semibold"
              disabled={form.state.isSubmitting}
            >
              {form.state.isSubmitting ? 'Mengirim…' : 'Subscribe'}
            </Button>
          </form>
        </div>
      </Reveal>
    </section>
  )
}
