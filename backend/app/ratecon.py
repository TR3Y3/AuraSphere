"""Rate-confirmation document generation.

Renders a clean, print-ready HTML rate con from load + option data — zero new
dependencies (no PDF lib); the carrier's browser prints/saves it as PDF and
the signed copy is filed under the load's Documents. Swap in a PDF engine
later behind this same `render_rate_con` signature if needed.
"""
import hashlib
from datetime import datetime, timezone

from app.models import Carrier, Load, Organization


def _money(v) -> str:
    if v is None:
        return "—"
    return f"${float(v):,.2f}"


def _loc(city, st) -> str:
    return ", ".join(p for p in [city, st] if p) or "—"


def render_rate_con(org: Organization, load: Load, carrier: Carrier | None,
                    carrier_name: str, rate) -> str:
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    mc = (carrier.mc_number if carrier else None) or "—"
    return f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#111">
  <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #111;padding-bottom:10px">
    <h1 style="margin:0;font-size:22px">RATE CONFIRMATION</h1>
    <div style="text-align:right;font-size:13px"><strong>{org.name}</strong><br>{today}<br>Load {load.reference or load.id}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
    <tr>
      <td style="padding:8px;border:1px solid #999;width:50%"><strong>CARRIER</strong><br>{carrier_name}<br>MC: {mc}</td>
      <td style="padding:8px;border:1px solid #999"><strong>BROKER</strong><br>{org.name}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #999"><strong>PICKUP</strong><br>{_loc(load.origin_city, load.origin_state)}<br>{load.pickup_date.strftime('%m/%d/%Y') if load.pickup_date else 'TBD'}</td>
      <td style="padding:8px;border:1px solid #999"><strong>DELIVERY</strong><br>{_loc(load.dest_city, load.dest_state)}<br>{load.delivery_date.strftime('%m/%d/%Y') if load.delivery_date else 'TBD'}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #999">Equipment: <strong>{load.equipment or '—'}</strong><br>Commodity: {load.commodity or '—'}<br>Weight: {f'{load.weight:,} lbs' if load.weight else '—'}</td>
      <td style="padding:8px;border:1px solid #999;vertical-align:middle;text-align:center">
        <div style="font-size:12px;color:#555">TOTAL CARRIER PAY</div>
        <div style="font-size:26px;font-weight:bold">{_money(rate)}</div>
      </td>
    </tr>
  </table>

  <p style="font-size:12px;color:#444;margin-top:14px">
    Carrier agrees to transport the above shipment for the rate shown, maintain active authority and
    insurance for the duration, and provide a signed POD for payment. This confirmation is subject to
    the broker-carrier agreement between the parties.
  </p>
</div>
"""


def doc_hash(html: str) -> str:
    return hashlib.sha256(html.encode()).hexdigest()
