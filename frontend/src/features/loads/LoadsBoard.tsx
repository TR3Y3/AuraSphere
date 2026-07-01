import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import type { Load } from '../../lib/api'
import { STATUS_LABEL, money, useChangeStatus, type LoadListParams } from './api'

function LoadCard({ load }: { load: Load }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: load.id })
  const route = [load.origin_city, load.dest_city].filter(Boolean).join(' → ')
  return (
    <div ref={setNodeRef} className={`deal-card${isDragging ? ' dragging' : ''}`}
      {...listeners} {...attributes} onClick={() => navigate(`/loads/${load.id}`)}>
      <div className="dc-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {load.reference ?? `Load ${load.id}`}
        {load.posted_to_dat && <span className="badge b-brand" style={{ fontSize: 10 }} title="Posted to DAT">DAT</span>}
      </div>
      {load.shipper && <div className="dc-sub">{load.shipper.name}</div>}
      {route && <div className="dc-sub">{route}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="dc-sub">{money(load.customer_rate)}</span>
        {load.margin != null && <span className="dc-amt">+{money(load.margin)}</span>}
      </div>
    </div>
  )
}

function Column({ status, loads }: { status: string; loads: Load[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className={`col${isOver ? ' drop-over' : ''}`}>
      <div className="col-head">
        <span className="name">{STATUS_LABEL[status] ?? status}</span>
        <span className="count">{loads.length}</span>
      </div>
      <div className="col-body" ref={setNodeRef}>
        {loads.map((l) => <LoadCard key={l.id} load={l} />)}
      </div>
    </div>
  )
}

export function LoadsBoard({
  pipeline,
  loads,
  listKey,
}: {
  pipeline: string[]
  loads: Load[]
  listKey: LoadListParams
}) {
  const changeStatus = useChangeStatus(listKey)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const id = Number(e.active.id)
    const status = String(e.over.id)
    const load = loads.find((l) => l.id === id)
    if (load && load.status !== status) changeStatus.mutate({ id, status })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board">
        {pipeline.map((status) => (
          <Column key={status} status={status} loads={loads.filter((l) => l.status === status)} />
        ))}
      </div>
    </DndContext>
  )
}
