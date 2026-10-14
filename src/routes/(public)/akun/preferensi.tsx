import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  preferencesOptions,
  savePreferences
  
} from '#/server/fn/account'
import type {PreferenceInput} from '#/server/fn/account';
import { categoriesOptions } from '#/server/fn/product'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'

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

const STYLES = ['ultralight', 'family', 'ekspedisi', 'hemat', 'premium', 'ceria'] as const

const MODE_LABEL: Record<string, string> = { buy: 'Beli', rent: 'Sewa', any: 'Bebas' }

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

function PreferensiPage() {
  const { data, isLoading } = useQuery(preferencesOptions)
  const { data: categories } = useQuery(categoriesOptions)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 rounded-[24px]" />
      </div>
    )
  }

  return <PreferensiForm initial={toFormValues(data ?? null)} categories={categories ?? []} />
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
      await queryClient.invalidateQueries({ queryKey: preferencesOptions.queryKey })
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Preferensi Rekomendasi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dipakai untuk menyusun rekomendasi gear yang cocok buat kamu.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => form.reset(toFormValues(null))}
        >
          Reset profil
        </Button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        className="mt-6 space-y-6 rounded-[24px] border border-border/70 bg-card p-6"
      >
        <fieldset>
          <legend className="text-sm font-semibold">Kategori favorit</legend>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            {categories.map((cat) => (
              <form.Field
                key={cat.id}
                name="categories"
                children={(field) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.state.value.includes(cat.id)}
                      onCheckedChange={() =>
                        field.handleChange(toggle(field.state.value, cat.id))
                      }
                    />
                    {cat.name}
                  </label>
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
                value === '' || (Number(value) >= 0 && Number.isFinite(Number(value)))
                  ? undefined
                  : 'Tidak valid',
            }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Budget minimum (Rp)</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="100000"
                />
              </div>
            )}
          />
          <form.Field
            name="budgetMax"
            validators={{
              onSubmit: ({ value }) =>
                value === '' || (Number(value) >= 0 && Number.isFinite(Number(value)))
                  ? undefined
                  : 'Tidak valid',
            }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Budget maksimum (Rp)</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="1500000"
                />
              </div>
            )}
          />
          <form.Field
            name="partySize"
            validators={{
              onSubmit: ({ value }) =>
                value === '' || (Number(value) >= 1 && Number.isInteger(Number(value)))
                  ? undefined
                  : 'Minimal 1 orang',
            }}
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Jumlah orang</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="4"
                />
              </div>
            )}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">Kondisi cuaca / medan</legend>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            {CONDITIONS.map((cond) => (
              <form.Field
                key={cond}
                name="conditions"
                children={(field) => (
                  <label className="flex items-center gap-2 text-sm capitalize">
                    <Checkbox
                      checked={field.state.value.includes(cond)}
                      onCheckedChange={() => field.handleChange(toggle(field.state.value, cond))}
                    />
                    {cond}
                  </label>
                )}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Gaya berkemah</legend>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            {STYLES.map((style) => (
              <form.Field
                key={style}
                name="style"
                children={(field) => (
                  <label className="flex items-center gap-2 text-sm capitalize">
                    <Checkbox
                      checked={field.state.value.includes(style)}
                      onCheckedChange={() => field.handleChange(toggle(field.state.value, style))}
                    />
                    {style}
                  </label>
                )}
              />
            ))}
          </div>
        </fieldset>

        <form.Field
          name="preferMode"
          children={(field) => (
            <div className="grid w-full max-w-xs gap-2">
              <Label>Preferensi transaksi</Label>
              <Select value={field.state.value} onValueChange={(val) => field.handleChange(val as FormValues['preferMode'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABEL)).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {MODE_LABEL[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />

        <Button type="submit" className="rounded-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Menyimpan…' : 'Simpan preferensi'}
        </Button>
      </form>
    </div>
  )
}
