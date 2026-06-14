# Billing Status — Implementation Plan

## Current state (as of Jun 2026)

**Billing / payment status does not exist** in the codebase.

What exists today:
- Orders have a **kitchen workflow status**: `new` → `preparing` → `ready` → `served`
- Order totals are computed at creation from menu prices (INR ₹)
- The Bill view (`/orders/:id`) shows line items and grand total (print-friendly)
- Dashboard reports **revenue_served** (sum of totals where status = `served`)

There is no concept of:
- Payment collected / pending / partial
- Invoice numbers or GST
- Room-charge vs cash vs UPI
- Refunds or voids (only admin order delete)

## Recommended Phase 1 — Order payment status

Minimal addition aligned with cafe ops (not full PMS billing).

### Data model (`orders` collection)

Add fields to each order document:

```json
{
  "payment_status": "unpaid",
  "payment_method": null,
  "paid_at": null,
  "paid_amount": 0,
  "payment_note": ""
}
```

Enums:
- `payment_status`: `unpaid` | `paid` | `comp` (complimentary) | `room_charge`
- `payment_method`: `cash` | `upi` | `room` | `other` | null

Default on create: `payment_status: "unpaid"`, `paid_amount: 0`.

### API endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `PATCH` | `/api/orders/{id}/payment` | admin + staff | Mark paid / update method |
| `GET` | `/api/orders?payment_status=unpaid` | auth | Filter unpaid bills |

Request body example:

```json
{
  "payment_status": "paid",
  "payment_method": "upi",
  "paid_amount": 340.0,
  "payment_note": "PhonePe ref optional"
}
```

Validation:
- `paid_amount` cannot exceed `total` (unless admin override flag)
- Setting `payment_status: "paid"` sets `paid_at` timestamp
- Staff can mark paid; only admin can set `comp` or delete payment record

### Dashboard changes

Extend `/api/dashboard` summary:
- `revenue_collected` — sum where `payment_status == "paid"`
- `unpaid_count` / `unpaid_total` — open bills
- Keep existing `revenue_served` for kitchen throughput vs cash collected

### UI changes

1. **Order detail / Bill view**
   - Payment badge (Unpaid / Paid / Room charge)
   - "Mark as paid" button with method picker (Cash / UPI / Room)
   - Show `paid_at` when paid

2. **Orders list**
   - Optional filter: All | Unpaid | Paid
   - Small payment icon on each row

3. **Kitchen view**
   - No change (kitchen cares about prep status, not payment)

4. **Dashboard (admin)**
   - KPI: Collected vs Served revenue gap
   - List of unpaid served orders (common cafe scenario: food served, payment pending)

### Workflow

```
Create order → unpaid
Kitchen: new → preparing → ready → served
Front desk: served + unpaid → mark paid (cash/upi/room)
```

Room charge status preps for future PMS integration without building PMS now.

## Phase 2 (future)

- Per-room running tab (aggregate unpaid `room_charge` orders)
- GST line items and invoice PDF
- Daily cash reconciliation report
- Integration with Chhaon Stays PMS guest folio

## Files to touch (Phase 1 estimate)

- `backend/server.py` — model, endpoint, dashboard aggregation
- `frontend/src/pages/OrderDetail.jsx` — payment UI
- `frontend/src/pages/Orders.jsx` — filter + badge
- `frontend/src/pages/Dashboard.jsx` — new KPIs
- `backend/tests/backend_test.py` — payment flow tests

## Out of scope

- Inventory consumption, vendor invoices, procurement (see PRD P3)
- Thermal printer / KOT (PRD P2)
