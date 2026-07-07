import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { CheckCall } from '../../lib/api'

// Real map tiles (OSM, keyless). Degrades gracefully on locked-down networks:
// if tiles can't load, the pane just stays dark — the schematic route bar
// above remains the always-works fallback. Truck marker = divIcon (no bundled
// image assets, which break under Vite).
export function LiveMap({ pings }: { pings: CheckCall[] }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  const located = pings.filter((p) => p.latitude != null && p.longitude != null)

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: true, attributionControl: false })
      .setView([37.8, -96], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16 }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !layer.current) return
    layer.current.clearLayers()
    if (located.length === 0) return

    // Breadcrumb trail (oldest → newest) + a truck at the latest position.
    const path = [...located].reverse().map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number])
    L.polyline(path, { color: '#8b5cf6', weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(layer.current)
    path.slice(0, -1).forEach((pt) => L.circleMarker(pt, {
      radius: 4, color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.9,
    }).addTo(layer.current!))
    const latest = path[path.length - 1]
    L.marker(latest, {
      icon: L.divIcon({ html: '<div style="font-size:22px;line-height:1">🚚</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] }),
    }).addTo(layer.current)

    if (path.length > 1) map.current.fitBounds(L.latLngBounds(path).pad(0.25))
    else map.current.setView(latest, 8)
  }, [located.map((p) => p.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  if (located.length === 0) return null
  return (
    <div>
      <div ref={el} style={{ height: 260, borderRadius: 10, border: '1px solid var(--border)', marginTop: 14, overflow: 'hidden', background: 'var(--surface-2)' }} />
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        Live GPS trail · map tiles stream from OpenStreetMap (trail still shows if tiles are blocked)
      </div>
    </div>
  )
}
