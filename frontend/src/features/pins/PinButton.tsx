import { useCreatePin, useDeletePin, usePins } from './api'

// Pin / unpin the current record to the dashboard. Optionally seeds a note.
export function PinButton({
  entityType,
  entityId,
}: {
  entityType: 'load' | 'contact' | 'carrier' | 'shipper'
  entityId: number
}) {
  const { data: pins } = usePins()
  const create = useCreatePin()
  const del = useDeletePin()
  const existing = pins?.find((p) => p.entity_type === entityType && p.entity_id === entityId)

  const toggle = () => {
    if (existing) del.mutate(existing.id)
    else create.mutate({ entity_type: entityType, entity_id: entityId })
  }

  return (
    <button className={`btn ${existing ? '' : 'ghost'}`} onClick={toggle}
      title={existing ? 'Unpin from dashboard' : 'Pin to dashboard'}>
      {existing ? '★ Pinned' : '☆ Pin'}
    </button>
  )
}
