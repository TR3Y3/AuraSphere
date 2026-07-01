"""Dashboard summary + lane pricing analytics (F5)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def _seed_loads(client, shipper_id):
    mk = lambda **kw: client.post("/api/loads", json={"shipper_id": shipper_id, **kw})
    mk(origin_city="Atlanta", origin_state="GA", dest_city="Miami", dest_state="FL",
       equipment="Dry Van", customer_rate="1000", carrier_rate="800", status="delivered")
    mk(origin_city="Atlanta", origin_state="GA", dest_city="Miami", dest_state="FL",
       equipment="Dry Van", customer_rate="1200", carrier_rate="900", status="covered")
    mk(origin_city="Savannah", origin_state="GA", dest_city="Tampa", dest_state="FL",
       customer_rate="900", carrier_rate="700", status="quote")
    mk(customer_rate="500", status="lost")  # terminal — excluded from loaded $


def test_summary_kpis_and_value_by_status(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    _seed_loads(client, _shipper(db, seeded["org_a"]).id)

    s = client.get("/api/dashboard/summary").json()
    # Quotes are excluded from the dashboard entirely (they live in Quotes):
    # only the delivered, covered, and lost loads count.
    assert s["loads_total"] == 3
    # loaded $ excludes the lost (terminal) AND the quote: 1000 + 1200 = 2200
    assert s["loaded_dollars"] == "2200.00"
    # margin from the 2 booked loads with both rates: 200 + 300 = 500
    assert s["total_margin"] == "500.00"
    assert s["avg_margin"] is not None
    statuses = {v["status"]: v for v in s["value_by_status"]}
    assert statuses["covered"]["count"] == 1
    # Quotes never appear in value-by-status.
    assert "quote" not in statuses


def test_lane_pricing_aggregates(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    _seed_loads(client, _shipper(db, seeded["org_a"]).id)

    lanes = client.get("/api/pricing/lanes").json()
    atl_mia = next(l for l in lanes if l["origin"] == "Atlanta, GA")
    assert atl_mia["loads"] == 2
    assert atl_mia["avg_customer_rate"] == "1100.00"  # (1000+1200)/2
    assert atl_mia["avg_carrier_rate"] == "850.00"    # (800+900)/2
    assert atl_mia["avg_margin"] == "250.00"


def test_dashboard_isolation(client, seeded):
    _login(client, "b@example.com", "password-b")
    s = client.get("/api/dashboard/summary").json()
    assert s["loads_total"] == 0
    assert s["loaded_dollars"] == "0.00" or s["loaded_dollars"] == "0"
    assert client.get("/api/pricing/lanes").json() == []
