import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Load } from '../../lib/api'
import { CityDatalist, splitCityState } from '../../lib/usCities'
import { useCompanies } from '../companies/api'
import { useCarriers } from '../carriers/api'
import { useCreateLoad, useUpdateLoad } from './api'

const schema = z.object({
  shipper_id: z.coerce.number().optional(),
  carrier_id: z.coerce.number().optional(),
  commodity: z.string().optional(),
  weight: z.coerce.number().optional(),
  equipment: z.string().optional(),
  origin_city: z.string().optional(),
  origin_state: z.string().optional(),
  dest_city: z.string().optional(),
  dest_state: z.string().optional(),
  pickup_date: z.string().optional(),
  delivery_date: z.string().optional(),
  total_miles: z.coerce.number().optional(),
  customer_rate: z.string().optional(),
  target_rate: z.string().optional(),
  carrier_rate: z.string().optional(),
  post_to_dat: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

const iso = (d?: string) => (d ? new Date(d).toISOString() : null)

export function LoadForm({
  mode = 'load',
  existing,
  onDone,
}: {
  mode?: 'load' | 'quote'
  existing?: Load
  onDone: (load?: Load) => void
}) {
  const isQuote = mode === 'quote' && !existing
  const { data: shippers } = useCompanies({ page_size: 200, sort: 'name', order: 'asc' })
  const { data: carriers } = useCarriers({ page_size: 200 })
  const create = useCreateLoad()
  const update = useUpdateLoad(existing?.id ?? 0)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      shipper_id: existing?.shipper_id ?? undefined,
      carrier_id: existing?.carrier_id ?? undefined,
      commodity: existing?.commodity ?? '',
      weight: existing?.weight ?? undefined,
      equipment: existing?.equipment ?? '',
      origin_city: existing?.origin_city ?? '',
      origin_state: existing?.origin_state ?? '',
      dest_city: existing?.dest_city ?? '',
      dest_state: existing?.dest_state ?? '',
      pickup_date: existing?.pickup_date?.slice(0, 10) ?? '',
      delivery_date: existing?.delivery_date?.slice(0, 10) ?? '',
      total_miles: existing?.total_miles ?? undefined,
      customer_rate: existing?.customer_rate ?? '',
      target_rate: existing?.target_rate ?? '',
      carrier_rate: existing?.carrier_rate ?? '',
      post_to_dat: false,
    },
  })

  const onSubmit = async (v: FormValues) => {
    const body = {
      shipper_id: v.shipper_id || null,
      carrier_id: isQuote ? null : v.carrier_id || null,
      commodity: v.commodity || null,
      weight: v.weight || null,
      equipment: v.equipment || null,
      origin_city: v.origin_city || null,
      origin_state: v.origin_state || null,
      dest_city: v.dest_city || null,
      dest_state: v.dest_state || null,
      pickup_date: iso(v.pickup_date),
      delivery_date: iso(v.delivery_date),
      total_miles: v.total_miles || null,
      customer_rate: v.customer_rate || null,
      target_rate: v.target_rate || null,
      carrier_rate: isQuote ? null : v.carrier_rate || null,
    }
    if (existing) { await update.mutateAsync(body); onDone() }
    else { const created = await create.mutateAsync({ ...body, status: 'quote', post_to_dat: !!v.post_to_dat }); onDone(created) }
  }

  return (
    <form className="form-grid two-col" onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid' }}>
      <label className="field">
        <span className="cl">Shipper (customer)</span>
        <select className="ti" {...register('shipper_id')}>
          <option value="">(none)</option>
          {shippers?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="field"><span className="cl">Equipment</span><input className="ti" placeholder="53' Van" {...register('equipment')} /></label>
      <CityDatalist />
      <label className="field"><span className="cl">Origin city</span>
        <input className="ti" list="us-cities" placeholder="Start typing a city…"
          {...register('origin_city', { onChange: (e) => {
            const cs = splitCityState(e.target.value)
            if (cs) { setValue('origin_city', cs.city); setValue('origin_state', cs.state) }
          } })} />
      </label>
      <label className="field"><span className="cl">Origin state</span><input className="ti" maxLength={2} {...register('origin_state')} /></label>
      <label className="field"><span className="cl">Destination city</span>
        <input className="ti" list="us-cities" placeholder="Start typing a city…"
          {...register('dest_city', { onChange: (e) => {
            const cs = splitCityState(e.target.value)
            if (cs) { setValue('dest_city', cs.city); setValue('dest_state', cs.state) }
          } })} />
      </label>
      <label className="field"><span className="cl">Destination state</span><input className="ti" maxLength={2} {...register('dest_state')} /></label>
      <label className="field"><span className="cl">Pickup date</span><input className="ti" type="date" {...register('pickup_date')} /></label>
      <label className="field"><span className="cl">Delivery date</span><input className="ti" type="date" {...register('delivery_date')} /></label>
      <label className="field"><span className="cl">Commodity</span><input className="ti" {...register('commodity')} /></label>
      <label className="field"><span className="cl">Weight (lbs)</span><input className="ti" type="number" {...register('weight')} /></label>
      <label className="field"><span className="cl">Total miles</span><input className="ti" type="number" {...register('total_miles')} /></label>
      <label className="field"><span className="cl">Customer rate ($)</span><input className="ti" type="number" step="0.01" {...register('customer_rate')} /></label>
      <label className="field"><span className="cl">Target buy ($)</span><input className="ti" type="number" step="0.01" {...register('target_rate')} /></label>
      {!isQuote && (
        <>
          <label className="field">
            <span className="cl">Carrier</span>
            <select className="ti" {...register('carrier_id')}>
              <option value="">(unassigned)</option>
              {carriers?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="cl">Carrier rate ($)</span><input className="ti" type="number" step="0.01" {...register('carrier_rate')} /></label>
        </>
      )}
      {!existing && (
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="check" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" {...register('post_to_dat')} /> 📡 Post to the DAT load board when created
          </label>
        </div>
      )}
      <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
        <button className="btn" type="submit" disabled={isSubmitting}>
          {existing ? 'Save' : isQuote ? 'Create quote' : 'Create load'}
        </button>
        <button className="btn ghost" type="button" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  )
}
