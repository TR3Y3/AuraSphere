"""Load status workflow (F2)."""

# Ordered main pipeline — these are the board columns, left to right.
LOAD_PIPELINE = [
    "quote",
    "tendered",
    "offered",
    "covered",
    "dispatched",
    "in_transit",
    "delivered",
    "invoiced",
]

# Terminal off-pipeline statuses (reachable via actions, not board columns).
LOAD_TERMINAL = ["lost", "tonu"]

LOAD_STATUSES = LOAD_PIPELINE + LOAD_TERMINAL


def is_valid_status(status: str) -> bool:
    return status in LOAD_STATUSES
