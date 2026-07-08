import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Contact } from '../../lib/api'
import { useCompanies } from '../companies/api'
import { useCarriers } from '../carriers/api'
import { useUsers } from '../users/api'
import { useCreateContact, useUpdateContact } from './api'

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  title: z.string().optional(),
  company_id: z.coerce.number().optional(),
  carrier_id: z.coerce.number().optional(),
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
  const { data: carriers } = useCarriers({ page_size: 200 })
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
      carrier_id: existing?.carrier_id ?? undefined,
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
      carrier_id: values.carrier_id || null,
      owner_id: values.owner_id,
    }
    if (existing) await update.mutateAsync(body)
    else await create.mutateAsync(body)
    onDone()
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
      <label className="field">
        <span className="cl">First name</span>
        <input className="ti" {...register('first_name')} />
        {errors.first_name && <span className="err-text">{errors.first_name.message}</span>}
      </label>
      <label className="field">
        <span className="cl">Last name</span>
        <input className="ti" {...register('last_name')} />
      </label>
      <label className="field">
        <span className="cl">Email</span>
        <input className="ti" {...register('email')} />
        {errors.email && <span className="err-text">{errors.email.message}</span>}
      </label>
      <label className="field">
        <span className="cl">Phone</span>
        <input className="ti" {...register('phone')} />
      </label>
      <label className="field">
        <span className="cl">Title</span>
        <input className="ti" {...register('title')} />
      </label>
      <label className="field">
        <span className="cl">Shipper</span>
        <select className="ti" {...register('company_id')}>
          <option value="">(none)</option>
          {companies?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="cl">Carrier</span>
        <select className="ti" {...register('carrier_id')}>
          <option value="">(none)</option>
          {carriers?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="cl">Owner</span>
        <select className="ti" {...register('owner_id')}>
          <option value="">(me)</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={isSubmitting}>{existing ? 'Save' : 'Create'}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
