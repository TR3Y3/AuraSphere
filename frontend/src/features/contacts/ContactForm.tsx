import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Contact } from '../../lib/api'
import { useCompanies } from '../companies/api'
import { useUsers } from '../users/api'
import { useCreateContact, useUpdateContact } from './api'

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  title: z.string().optional(),
  company_id: z.coerce.number().optional(),
  owner_id: z.coerce.number().optional(),
})
type FormValues = z.infer<typeof schema>

export function ContactForm({
  existing,
  onDone,
}: {
  existing?: Contact
  onDone: () => void
}) {
  const { data: companies } = useCompanies({ page_size: 200, sort: 'name', order: 'asc' })
  const { data: users } = useUsers()
  const create = useCreateContact()
  const update = useUpdateContact(existing?.id ?? 0)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: existing?.first_name ?? '',
      last_name: existing?.last_name ?? '',
      email: existing?.email ?? '',
      phone: existing?.phone ?? '',
      title: existing?.title ?? '',
      company_id: existing?.company_id ?? undefined,
      owner_id: existing?.owner_id ?? undefined,
    },
  })

  const onSubmit = async (values: FormValues) => {
    const body = {
      first_name: values.first_name,
      last_name: values.last_name || null,
      email: values.email || null,
      phone: values.phone || null,
      title: values.title || null,
      company_id: values.company_id || null,
      owner_id: values.owner_id,
    }
    if (existing) await update.mutateAsync(body)
    else await create.mutateAsync(body)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 10 }}>
      <div>
        <input placeholder="First name" {...register('first_name')} style={{ padding: 8, width: '100%' }} />
        {errors.first_name && <small style={{ color: 'red' }}>{errors.first_name.message}</small>}
      </div>
      <input placeholder="Last name" {...register('last_name')} style={{ padding: 8 }} />
      <div>
        <input placeholder="Email" {...register('email')} style={{ padding: 8, width: '100%' }} />
        {errors.email && <small style={{ color: 'red' }}>{errors.email.message}</small>}
      </div>
      <input placeholder="Phone" {...register('phone')} style={{ padding: 8 }} />
      <input placeholder="Title" {...register('title')} style={{ padding: 8 }} />
      <label>
        Company
        <select {...register('company_id')} style={{ padding: 8, width: '100%' }}>
          <option value="">(none)</option>
          {companies?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
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
        <button type="submit" disabled={isSubmitting}>{existing ? 'Save' : 'Create'}</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
