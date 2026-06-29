import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import type { Deal, Pipeline, Stage } from '../../lib/api'
import { useChangeStage, type DealListParams } from './api'

function money(amount: string | null): string {
  if (!amount) return ''
  const n = Number(amount)
  if (Number.isNaN(n)) return ''
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function DealCard({ deal }: { deal: Deal }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id })
  return (
    <div
      ref={setNodeRef}
      className={`deal-card${isDragging ? ' dragging' : ''}`}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/deals/${deal.id}`)}
    >
      <div className="dc-name">{deal.name}</div>
      {deal.amount && <div className="dc-amt">{money(deal.amount)}</div>}
      {deal.company && <div className="dc-sub">{deal.company.name}</div>}
    </div>
  )
}

function Column({ stage, deals }: { stage: Stage; deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((s, d) => s + (d.amount ? Number(d.amount) : 0), 0)
  return (
    <div className={`col${isOver ? ' drop-over' : ''}`}>
      <div className="col-head">
        <span className="name">{stage.name}</span>
        <span className="count">{deals.length}</span>
      </div>
      <div className="col-body" ref={setNodeRef}>
        {deals.map((d) => <DealCard key={d.id} deal={d} />)}
      </div>
      {total > 0 && (
        <div className="col-sum">
          {total.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
        </div>
      )}
    </div>
  )
}

export function DealsBoard({
  pipeline,
  deals,
  listKey,
}: {
  pipeline: Pipeline
  deals: Deal[]
  listKey: DealListParams
}) {
  const changeStage = useChangeStage(listKey)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const dealId = Number(e.active.id)
    const stageId = Number(e.over.id)
    const deal = deals.find((d) => d.id === dealId)
    if (deal && deal.stage_id !== stageId) {
      changeStage.mutate({ id: dealId, stage_id: stageId })
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board">
        {pipeline.stages.map((stage) => (
          <Column key={stage.id} stage={stage} deals={deals.filter((d) => d.stage_id === stage.id)} />
        ))}
      </div>
    </DndContext>
  )
}
