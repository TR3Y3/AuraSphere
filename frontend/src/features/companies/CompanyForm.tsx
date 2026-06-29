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
    }
    if (existing) await update.mutateAsync(body)
    else await create.mutateAsync(body)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 10 }}>
      <div>
        <input placeholder="Name" {...register('name')} style={{ padding: 8, width: '100%' }} />
        {errors.name && <small style={{ color: 'red' }}>{errors.name.message}</small>}
      </div>
      <input placeholder="Domain" {...register('domain')} style={{ padding: 8 }} />
      <input placeholder="Industry" {...register('industry')} style={{ padding: 8 }} />
      <input placeholder="Phone" {...register('phone')} style={{ padding: 8 }} />
      <input placeholder="Website" {...register('website')} style={{ padding: 8 }} />
      <label>
        Owner
        <select {...register('owner_id')} style={{ padding: 8, width: '100%' }}>
          <option value="">(me)</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={isSubmitting}>
          {existing ? 'Save' : 'Create'}
        </button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
