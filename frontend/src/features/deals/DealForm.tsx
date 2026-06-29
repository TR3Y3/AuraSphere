import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Deal, Pipeline } from '../../lib/api'
import { useCompanies } from '../companies/api'
import { useContacts } from '../contacts/api'
import { useUsers } from '../users/api'
import { useCreateDeal, useUpdateDeal } from './api'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.string().optional(),
  company_id: z.coerce.number().optional(),
  primary_contact_id: z.coerce.number().optional(),
  stage_id: z.coerce.number().optional(),
  owner_id: z.coerce.number().optional(),
  expected_close_date: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function DealForm({
  pipeline,
  existing,
  onDone,
}: {
  pipeline: Pipeline
  existing?: Deal
  onDone: () => void
}) {
  const { data: companies } = useCompanies({ page_size: 200, sort: 'name', order: 'asc' })
  const { data: contacts } = useContacts({ page_size: 200, sort: 'first_name', order: 'asc' })
  const { data: users } = useUsers()
  const create = useCreateDeal()
  const update = useUpdateDeal(existing?.id ?? 0)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      amount: existing?.amount ?? '',
      company_id: existing?.company_id ?? undefined,
      primary_contact_id: existing?.primary_contact_id ?? undefined,
      stage_id: existing?.stage_id ?? pipeline.stages[0]?.id,
      owner_id: existing?.owner_id ?? undefined,
      expected_close_date: existing?.expected_close_date?.slice(0, 10) ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const body = {
      name: values.name,
      amount: values.amount ? values.amount : null,
      company_id: values.company_id || null,
      primary_contact_id: values.primary_contact_id || null,
      stage_id: values.stage_id,
      owner_id: values.owner_id,
      pipeline_id: pipeline.id,
      expected_close_date: values.expected_close_date
        ? new Date(values.expected_close_date).toISOString()
        : null,
    }
    if (existing) await update.mutateAsync(body)
    else await create.mutateAsync(body)
    onDone()
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
      <div className="field">
        <label className="cl">Name</label>
        <input className="ti" placeholder="Acme — annual contract" {...register('name')} />
        {errors.name && <span className="err-text">{errors.name.message}</span>}
      </div>
      <div className="field">
        <label className="cl">Amount</label>
        <input className="ti" type="number" step="0.01" placeholder="5000" {...register('amount')} />
      </div>
      <div className="field">
        <label className="cl">Stage</label>
        <select className="ti" {...register('stage_id')}>
          {pipeline.stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="cl">Company</label>
        <select className="ti" {...register('company_id')}>
          <option value="">(none)</option>
          {companies?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="cl">Primary contact</label>
        <select className="ti" {...register('primary_contact_id')}>
          <option value="">(none)</option>
          {contacts?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="cl">Expected close</label>
        <input className="ti" type="date" {...register('expected_close_date')} />
      </div>
      <div className="field">
        <label className="cl">Owner</label>
        <select className="ti" {...register('owner_id')}>
          <option value="">(me)</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={isSubmitting}>{existing ? 'Save' : 'Create'}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
