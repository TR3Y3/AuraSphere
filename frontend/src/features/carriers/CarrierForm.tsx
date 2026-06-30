import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Carrier } from '../../lib/api'
import { useUsers } from '../users/api'
import { useCreateCarrier, useUpdateCarrier } from './api'

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
  const {
    register,
    handleSubmit,
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
      <div className="field"><label className="cl">MC #</label><input className="ti" {...register('mc_number')} /></div>
      <div className="field"><label className="cl">DOT #</label><input className="ti" {...register('dot_number')} /></div>
      <div className="field"><label className="cl">HQ city</label><input className="ti" {...register('hq_city')} /></div>
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
