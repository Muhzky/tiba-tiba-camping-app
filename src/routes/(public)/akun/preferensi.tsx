import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import {
  preferencesOptions,
  recommendationProfileOptions,
  savePreferences,
} from '#/server/fn/account'
import type { PreferenceInput } from '#/server/fn/account'
import { queryKeys } from '#/lib/query-keys'
import { categoriesOptions } from '#/server/fn/product'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from 'cn'
import { AccountPageHeader, accountCard } from '#/components/site/AccountUI'

export const Route = createFileRoute('/(public)/akun/preferensi')({
  component: PreferensiPage,
})

const CONDITIONS = [
  'hujan',
  'panas terik',
  'dingin ekstrem',
  'angin kencang',
  'medan berat',
  'jalur pendek',
] as const

const STYLES = [
  'ultralight',
  'family',
  'ekspedisi',
  'hemat',
  'premium',
  'ceria',
] as const

const MODE_LABEL: Record<string, string> = {
  buy: 'Beli',
  rent: 'Sewa',
  any: 'Bebas',
}

type FormValues = {
  categories: string[]
  budgetMin: string
  budgetMax: string
  partySize: string
  conditions: string[]
  style: string[]
  preferMode: 'buy' | 'rent' | 'any'
}

function toFormValues(p: PreferenceInput | null): FormValues {
  return {
    categories: p?.categories ?? [],
    budgetMin: p?.budgetMin != null ? String(p.budgetMin) : '',
    budgetMax: p?.budgetMax != null ? String(p.budgetMax) : '',
    partySize: p?.partySize != null ? String(p.partySize) : '',
    conditions: p?.conditions ?? [],
    style: p?.style ?? [],
    preferMode: p?.preferMode ?? 'any',
  }
}

/** Chip pilihan — kotak centang tetap ada (tidak terlihat) supaya tetap
 *  bisa dioperasikan dengan keyboard dan dibaca pembaca layar. */
function ChoiceChip({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition duration-200',
        'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40',
        checked
          ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
          : 'border-border/70 bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground',
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      {checked ? (
        <Check className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
      {children}
    </label>
  )
}

function PreferensiPage() {
  const { data, isLoading } = useQuery(preferencesOptions)
  const { data: categories } = useQuery(categoriesOptions)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <PreferensiForm
      initial={toFormValues(data ?? null)}
      categories={categories ?? []}
    />
  )
}

function PreferensiForm({
  initial,
  categories,
}: {
  initial: FormValues
  categories: Array<{ id: string; name: string }>
}) {
  const queryClient = useQueryClient()
  const save = useServerFn(savePreferences)
  const mutation = useMutation({
    mutationFn: (value: PreferenceInput) => save({ data: value }),
    onSuccess: async () => {
      // Preferensi mengubah vektor profil CBF: segarkan ringkasan akun,
      // hasil katalog "Paling cocok", dan rekomendasi homepage.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: preferencesOptions.queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: recommendationProfileOptions.queryKey,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all() }),
      ])
      toast.success('Preferensi rekomendasi tersimpan.')
    },
    onError: () => toast.error('Gagal menyimpan preferensi.'),
  })

  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      const parse = (raw: string) => (raw.trim() === '' ? null : Number(raw))
      mutation.mutate({
        categories: value.categories,
        budgetMin: parse(value.budgetMin),
        budgetMax: parse(value.budgetMax),
        partySize: parse(value.partySize),
        conditions: value.conditions,
        style: value.style,
        preferMode: value.preferMode,
      })
    },
  })

  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  return (
    <div className="flex flex-col gap-7">
      <AccountPageHeader
        title="Preferensi Rekomendasi"
        description="Dipakai untuk menyusun rekomendasi gear yang cocok buat kamu."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => form.reset(toFormValues(null))}
          >
            Reset profil
          </Button>
        }
      />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        className="flex flex-col gap-5"
      >
        <section className={cn(accountCard, 'p-5 sm:p-6')}>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Kriteria utama
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Seberapa besar rombonganmu dan berapa anggaran yang disiapkan.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <fieldset>
              <legend className="text-xs font-semibold text-foreground">
                Kategori favorit
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <form.Field
                    key={cat.id}
                    name="categories"
                    children={(field) => (
                      <ChoiceChip
                        checked={field.state.value.includes(cat.id)}
                        onCheckedChange={() =>
                          field.handleChange(toggle(field.state.value, cat.id))
                        }
                      >
                        {cat.name}
                      </ChoiceChip>
                    )}
                  />
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <form.Field
                name="budgetMin"
                validators={{
                  onSubmit: ({ value }) =>
                    value === '' ||
                    (Number(value) >= 0 && Number.isFinite(Number(value)))
                      ? undefined
                      : 'Tidak valid',
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Budget minimum (Rp)</Label>
                    <Input
                      id={field.name}
                      className="h-9 bg-background"
                      inputMode="numeric"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="100000"
                    />
                  </div>
                )}
              />
              <form.Field
                name="budgetMax"
                validators={{
                  onSubmit: ({ value }) =>
                    value === '' ||
                    (Number(value) >= 0 && Number.isFinite(Number(value)))
                      ? undefined
                      : 'Tidak valid',
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Budget maksimum (Rp)</Label>
                    <Input
                      id={field.name}
                      className="h-9 bg-background"
                      inputMode="numeric"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="1500000"
                    />
                  </div>
                )}
              />
              <form.Field
                name="partySize"
                validators={{
                  onSubmit: ({ value }) =>
                    value === '' ||
                    (Number(value) >= 1 && Number.isInteger(Number(value)))
                      ? undefined
                      : 'Minimal 1 orang',
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Jumlah orang</Label>
                    <Input
                      id={field.name}
                      className="h-9 bg-background"
                      inputMode="numeric"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="4"
                    />
                  </div>
                )}
              />
            </div>

            <form.Field
              name="preferMode"
              children={(field) => (
                <div className="grid w-full max-w-xs gap-2">
                  <Label>Preferensi transaksi</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) =>
                      field.handleChange(val as FormValues['preferMode'])
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(MODE_LABEL).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {MODE_LABEL[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </div>
        </section>

        <section className={cn(accountCard, 'p-5 sm:p-6')}>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Kondisi & gaya
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bantu kami memilih gear yang pas dengan rencanamu.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <fieldset>
              <legend className="text-xs font-semibold text-foreground">
                Kondisi cuaca / medan
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {CONDITIONS.map((cond) => (
                  <form.Field
                    key={cond}
                    name="conditions"
                    children={(field) => (
                      <ChoiceChip
                        checked={field.state.value.includes(cond)}
                        onCheckedChange={() =>
                          field.handleChange(toggle(field.state.value, cond))
                        }
                      >
                        {cond}
                      </ChoiceChip>
                    )}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-foreground">
                Gaya berkemah
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {STYLES.map((style) => (
                  <form.Field
                    key={style}
                    name="style"
                    children={(field) => (
                      <ChoiceChip
                        checked={field.state.value.includes(style)}
                        onCheckedChange={() =>
                          field.handleChange(toggle(field.state.value, style))
                        }
                      >
                        {style}
                      </ChoiceChip>
                    )}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kosongkan bidang yang tidak penting — preferensi ini hanya dipakai
            untuk mengurutkan rekomendasi.
          </p>
          <Button
            type="submit"
            className="rounded-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Menyimpan…' : 'Simpan preferensi'}
          </Button>
        </div>
      </form>
    </div>
  )
}
