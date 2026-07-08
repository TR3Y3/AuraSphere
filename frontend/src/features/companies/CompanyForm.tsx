import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Company } from '../../lib/api'
import { useUsers } from '../users/api'
import { useCreateCompany, useUpdateCompany } from './api'

// Mirror the backend; the backend stays the source of truth for validation.
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  owner_id: z.coerce.number().optional(),
  secondary_owner_id: z.coerce.number().optional(),
})
type FormValues = z.infer<typeof schema>

export function CompanyForm({
  existing,
  onDone,
}: {
  existing?: Company
  onDone: () => void
}) {
  const { data: users } = useUsers()
  const create = useCreateCompany()
  const update = useUpdateCompany(existing?.id ?? 0)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      domain: existing?.domain ?? '',
      industry: existing?.industry ?? '',
      phone: existing?.phone ?? '',
      website: existing?.website ?? '',
      owner_id: existing?.owner_id ?? undefined,
      secondary_owner_id: existing?.secondary_owner_id ?? undefined,
    },
  })

  const onSubmit = async (values: FormValues) => {
    const body = {
      name: values.name,
      domain: values.domain || null,
      industry: values.industry || null,
      phone: values.phone || null,
      website: values.website || null,
      owner_id: values.owner_id,
      secondary_owner_id: values.secondary_owner_id || null,
    }
    if (existing) await update.mutateAsync(body)
    else await create.mutateAsync(body)
    onDone()
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
      <label className="field">
        <span className="cl">Name</span>
        <input className="ti" placeholder="Acme Corp" {...register('name')} />
        {errors.name && <span className="err-text">{errors.name.message}</span>}
      </label>
      <label className="field">
        <span className="cl">Domain</span>
        <input className="ti" placeholder="acme.com" {...register('domain')} />
      </label>
      <label className="field">
        <span className="cl">Industry</span>
        <input className="ti" {...register('industry')} />
      </label>
      <label className="field">
        <span className="cl">Phone</span>
        <input className="ti" {...register('phone')} />
      </label>
      <label className="field">
        <span className="cl">Website</span>
        <input className="ti" {...register('website')} />
      </label>
      <label className="field">
        <span className="cl">Primary rep (owner)</span>
        <select className="ti" {...register('owner_id')}>
          <option value="">(me)</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}{u.sales_code ? ` · ${u.sales_code}` : ''}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="cl">Backup rep (covers when primary is out)</span>
        <select className="ti" {...register('secondary_owner_id')}>
          <option value="">(none)</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}{u.sales_code ? ` · ${u.sales_code}` : ''}</option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={isSubmitting}>
          {existing ? 'Save' : 'Create'}
        </button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
