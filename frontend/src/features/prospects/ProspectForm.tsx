import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateProspect } from './api'

const schema = z.object({
  company_name: z.string().min(1, 'Company is required'),
  industry: z.string().optional(),
  domain: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  contact_name: z.string().optional(),
  contact_title: z.string().optional(),
  contact_email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  source: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function ProspectForm({ onDone }: { onDone: () => void }) {
  const create = useCreateProspect()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'manual' },
  })

  const onSubmit = async (v: FormValues) => {
    await create.mutateAsync({
      company_name: v.company_name,
      industry: v.industry || null,
      domain: v.domain || null,
      city: v.city || null,
      state: v.state || null,
      contact_name: v.contact_name || null,
      contact_title: v.contact_title || null,
      contact_email: v.contact_email || null,
      contact_phone: v.contact_phone || null,
      source: v.source || 'manual',
    })
    onDone()
  }

  return (
    <form className="form-grid two-col" onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid' }}>
      <label className="field">
        <span className="cl">Company</span>
        <input className="ti" {...register('company_name')} />
        {errors.company_name && <span className="err-text">{errors.company_name.message}</span>}
      </label>
      <label className="field"><span className="cl">Industry</span><input className="ti" placeholder="Manufacturing, Distribution…" {...register('industry')} /></label>
      <label className="field"><span className="cl">Domain</span><input className="ti" {...register('domain')} /></label>
      <label className="field"><span className="cl">City</span><input className="ti" {...register('city')} /></label>
      <label className="field"><span className="cl">State</span><input className="ti" maxLength={2} {...register('state')} /></label>
      <label className="field"><span className="cl">Contact name</span><input className="ti" {...register('contact_name')} /></label>
      <label className="field"><span className="cl">Contact title</span><input className="ti" placeholder="Logistics Manager" {...register('contact_title')} /></label>
      <label className="field">
        <span className="cl">Contact email</span>
        <input className="ti" {...register('contact_email')} />
        {errors.contact_email && <span className="err-text">{errors.contact_email.message}</span>}
      </label>
      <label className="field"><span className="cl">Contact phone</span><input className="ti" {...register('contact_phone')} /></label>
      <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
        <button className="btn" type="submit" disabled={isSubmitting}>Add prospect</button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
