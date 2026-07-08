// Standard freight equipment types — dropdown-first for fast entry, but the
// field stays free text (freight has too many edge cases to hard-lock it).
export const EQUIPMENT_TYPES = [
  'Dry Van',
  'Reefer',
  'Flatbed',
  'Step Deck',
  'RGN/Lowboy',
  'Specialized',
  'Power Only',
  'Expedite (Sprinter/Hotshot)',
  'Container/Intermodal',
  'Box Truck',
]

/** Render once per page that uses an equipment input. */
export function EquipmentDatalist() {
  return (
    <datalist id="equipment-types">
      {EQUIPMENT_TYPES.map((e) => <option key={e} value={e} />)}
    </datalist>
  )
}
