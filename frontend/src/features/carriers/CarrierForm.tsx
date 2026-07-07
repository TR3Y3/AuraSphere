import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, type Carrier, type CarrierLookup } from '../../lib/api'
import { useUsers } from '../users/api'
import { useCreateCarrier, useUpdateCarrier } from './api'
import { CityDatalist, splitCityState } from '../../lib/usCities'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  mc_number: z.string().optional(),
  dot_number: z.string().optional(),
  hq_city: z.string().optional(),
  hq_state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  status: z.enum(['active', 'deactivated']).optional(),
  rating: z.string().optional(),
  auto_liability: z.string().optional(),
  cargo_coverage: z.string().optional(),
  equipment_types: z.string().optional(),
  owner_id: z.coerce.number().optional(),
})
type FormValues = z.infer<typeof schema>

export function CarrierForm({ existing, onDone }: { existing?: Carrier; onDone: () => void }) {
  const { data: users } = useUsers()
  const create = useCreateCarrier()
  const update = useUpdateCarrier(existing?.id ?? 0)
  const [looking, setLooking] = useState(false)
  const [lookupNote, setLookupNote] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      mc_number: existing?.mc_number ?? '',
      dot_number: existing?.dot_number ?? '',
      hq_city: existing?.hq_city ?? '',
      hq_state: existing?.hq_state ?? '',
      phone: existing?.phone ?? '',
      email: existing?.email ?? '',
      status: (existing?.status as 'active' | 'deactivated') ?? 'active',
      rating: existing?.rating ?? '',
      auto_liability: existing?.auto_liability ?? '',
      cargo_coverage: existing?.cargo_coverage ?? '',
      equipment_types: existing?.equipment_types ?? '',
      owner_id: existing?.owner_id ?? undefined,
    },
  })

  const onSubmit = async (values: FormValues) => {
    const body = {
      name: values.name,
      mc_number: values.mc_number || null,
      dot_number: values.dot_number || null,
      hq_city: values.hq_city || null,
      hq_state: values.hq_state || null,
      phone: values.phone || null,
      email: values.email || null,
      status: values.status ?? 'active',
      rating: values.rating || null,
      auto_liability: values.auto_liability || null,
      cargo_coverage: values.cargo_coverage || null,
      equipment_types: values.equipment_types || null,
      owner_id: values.owner_id,
    }
    if (existing) await update.mutateAsync(body)
    else await create.mutateAsync(body)
    onDone()
  }

  // FMCSA auto-populate: MC number → legal name, DOT, HQ, phone, authority.
  async function lookupMc() {
    const mc = (getValues('mc_number') || '').trim()
    if (!mc) { setLookupNote('Enter an MC number first.'); return }
    setLooking(true); setLookupNote(null)
    try {
      const r = await api.get<CarrierLookup>('/api/carriers/lookup', { mc })
      if (!r.found) { setLookupNote('No FMCSA record found for that MC.'); return }
      if (r.legal_name && !getValues('name')) setValue('name', r.legal_name)
      if (r.dot_number) setValue('dot_number', r.dot_number)
      if (r.city) setValue('hq_city', r.city)
      if (r.state) setValue('hq_state', r.state)
      if (r.phone && !getValues('phone')) setValue('phone', r.phone)
      setLookupNote(
        `✓ Found ${r.legal_name ?? 'carrier'} — authority ${r.authority_status ?? 'unknown'}`
        + (r.source === 'stub' ? ' (demo data until FMCSA key is set)' : ''),
      )
    } catch {
      setLookupNote('Lookup failed — you can still fill fields manually.')
    } finally {
      setLooking(false)
    }
  }

  return (
    <form className="form-grid two-col" onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid' }}>
      <div className="field">
        <label className="cl">Carrier name</label>
        <input className="ti" {...register('name')} />
        {errors.name && <span className="err-text">{errors.name.message}</span>}
      </div>
      <div className="field">
        <label className="cl">Status</label>
        <select className="ti" {...register('status')}>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>
      <div className="field"><label className="cl">MC #</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="ti" placeholder="MC123456" {...register('mc_number')} />
          <button type="button" className="btn ghost" disabled={looking} title="Auto-fill from FMCSA by MC number"
            onClick={lookupMc}>
            {looking ? '…' : '⌕ Lookup'}
          </button>
        </div>
        {lookupNote && <span className="muted" style={{ fontSize: 12 }}>{lookupNote}</span>}
      </div>
      <div className="field"><label className="cl">DOT #</label><input className="ti" {...register('dot_number')} /></div>
      <CityDatalist />
      <div className="field"><label className="cl">HQ city</label>
        <input className="ti" list="us-cities" placeholder="Start typing a city…"
          {...register('hq_city', { onChange: (e) => {
            const cs = splitCityState(e.target.value)
            if (cs) { setValue('hq_city', cs.city); setValue('hq_state', cs.state) }
          } })} />
      </div>
      <div className="field"><label className="cl">HQ state</label><input className="ti" maxLength={2} {...register('hq_state')} /></div>
      <div className="field"><label className="cl">Phone</label><input className="ti" {...register('phone')} /></div>
      <div className="field">
        <label className="cl">Email</label>
        <input className="ti" {...register('email')} />
        {errors.email && <span className="err-text">{errors.email.message}</span>}
      </div>
      <div className="field"><label className="cl">Rating (0–5)</label><input className="ti" type="number" step="0.1" min="0" max="5" {...register('rating')} /></div>
      <div className="field"><label className="cl">Equipment types</label><input className="ti" placeholder="Dry Van, Reefer…" {...register('equipment_types')} /></div>
      <div className="field"><label className="cl">Auto liability ($)</label><input className="ti" type="number" {...register('auto_liability')} /></div>
      <div className="field"><label className="cl">Cargo coverage ($)</label><input className="ti" type="number" {...register('cargo_coverage')} /></div>
      <div className="field">
        <label className="cl">Owner</label>
        <select className="ti" {...register('owner_id')}>
          <option value="">(me)</option>
          {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>
      <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
        <button className="btn" type="submit" disabled={isSubmitting}>{existing ? 'Save' : 'Create'}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
