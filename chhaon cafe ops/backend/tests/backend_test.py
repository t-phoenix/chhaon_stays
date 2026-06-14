"""Chhaon Cafe Ops backend tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chhaon-cafe-ops.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

# Credentials from env only — set ADMIN_PASSWORD before running (see backend/.env.example).
ADMIN_MOBILE = os.environ.get('ADMIN_MOBILE', '9625005516')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
STAFF_PASSCODE = os.environ.get('STAFF_PASSCODE', '1234')

if not ADMIN_PASSWORD:
    pytest.skip('ADMIN_PASSWORD env var required (export from backend/.env)', allow_module_level=True)


@pytest.fixture(scope="session")
def admin_token():
    # Cookie-based auth: cookie is set on response. Tests use the Bearer header
    # (issued through the cookie value) as a portable fallback.
    s = requests.Session()
    lr = s.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD}, timeout=15)
    assert lr.status_code == 200, f"Login failed: {lr.status_code} {lr.text}"
    user_data = lr.json()
    assert user_data["user"]["role"] == "admin"
    cookie_token = lr.cookies.get('chhaon_access')
    assert cookie_token, "Expected chhaon_access cookie to be set"
    return cookie_token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def staff_user(admin_headers):
    # Ensure shared staff passcode is set
    requests.patch(f"{API}/auth/staff-passcode", headers=admin_headers, json={"passcode": STAFF_PASSCODE})
    lr = requests.post(f"{API}/auth/staff-login", json={"passcode": STAFF_PASSCODE})
    assert lr.status_code == 200, lr.text
    cookie_token = lr.cookies.get('chhaon_access')
    user = lr.json()["user"]
    assert user["role"] == "staff"
    return {"user": user, "token": cookie_token, "headers": {"Authorization": f"Bearer {cookie_token}"}, "passcode": STAFF_PASSCODE}


# ---------------- HEALTH ----------------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") == True  # noqa: E712


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "user" in data
        assert data["user"]["mobile"] == ADMIN_MOBILE
        assert data["user"]["role"] == "admin"
        # Cookie must be set
        assert r.cookies.get("chhaon_access")

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self):
        s = requests.Session()
        lr = s.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD})
        assert lr.status_code == 200
        # /auth/me using session cookie
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        out = s.post(f"{API}/auth/logout")
        assert out.status_code == 200
        # subsequent /me should now be 401
        me2 = s.get(f"{API}/auth/me")
        assert me2.status_code == 401


# ---------------- MENU ----------------
class TestMenu:
    def test_list_menu(self, admin_headers):
        r = requests.get(f"{API}/menu", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 20

    def test_menu_unauthorized(self):
        r = requests.get(f"{API}/menu")
        assert r.status_code == 401

    def test_menu_active_only(self, admin_headers):
        r = requests.get(f"{API}/menu?active_only=true", headers=admin_headers)
        assert r.status_code == 200
        for it in r.json():
            assert it["active"] == True  # noqa: E712

    def test_menu_crud(self, admin_headers):
        # Create
        r = requests.post(f"{API}/menu", headers=admin_headers, json={
            "name": "TEST_Item", "category": "Snacks", "price": 99.0, "active": True
        })
        assert r.status_code == 200
        item = r.json()
        iid = item["id"]
        assert item["name"] == "TEST_Item"
        # Update
        r2 = requests.patch(f"{API}/menu/{iid}", headers=admin_headers, json={"price": 120.0, "active": False})
        assert r2.status_code == 200
        assert r2.json()["price"] == 120.0
        assert r2.json()["active"] == False  # noqa: E712
        # Verify active_only excludes
        items = requests.get(f"{API}/menu?active_only=true", headers=admin_headers).json()
        assert all(x["id"] != iid for x in items)
        # Delete
        r3 = requests.delete(f"{API}/menu/{iid}", headers=admin_headers)
        assert r3.status_code == 200

    def test_menu_crud_staff_forbidden(self, staff_user):
        r = requests.post(f"{API}/menu", headers=staff_user["headers"], json={
            "name": "STAFF_Item", "category": "Snacks", "price": 50.0, "active": True
        })
        assert r.status_code == 403


# ---------------- ORDERS ----------------
class TestOrders:
    GUEST_MOBILE = "9876543210"

    def _menu_ids(self, admin_headers, n=2):
        items = requests.get(f"{API}/menu?active_only=true", headers=admin_headers).json()
        return [items[i]["id"] for i in range(n)]

    def _order(self, guest_name, items, **extra):
        return {"guest_name": guest_name, "guest_mobile": self.GUEST_MOBILE, "items": items, **extra}

    def test_create_order(self, admin_headers):
        ids = self._menu_ids(admin_headers, 2)
        r = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "TEST_Guest",
            [{"menu_item_id": ids[0], "quantity": 2}, {"menu_item_id": ids[1], "quantity": 1}],
            room_number="101",
            walk_in=False,
            notes="extra spicy",
        ))
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["status"] == "new"
        assert o["payment_status"] == "pending"
        assert o["subtotal"] > 0
        assert o["total"] == o["subtotal"]
        assert len(o["items"]) == 2

    def test_create_order_no_items(self, admin_headers):
        r = requests.post(f"{API}/orders", headers=admin_headers, json=self._order("X", []))
        assert r.status_code == 400

    def test_create_order_requires_mobile(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        r = requests.post(f"{API}/orders", headers=admin_headers, json={
            "guest_name": "NoMobile",
            "items": [{"menu_item_id": ids[0], "quantity": 1}],
        })
        assert r.status_code == 422

    def test_status_flow(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "Flow", [{"menu_item_id": ids[0], "quantity": 1}], walk_in=True,
        )).json()
        oid = cr["id"]
        for s in ["preparing", "ready", "served"]:
            r = requests.patch(f"{API}/orders/{oid}/status", headers=admin_headers, json={"status": s})
            assert r.status_code == 200
            assert r.json()["status"] == s

    def test_invalid_status(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "X", [{"menu_item_id": ids[0], "quantity": 1}],
        )).json()
        r = requests.patch(f"{API}/orders/{cr['id']}/status", headers=admin_headers, json={"status": "lost"})
        assert r.status_code == 400

    def test_active_only_list(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "Act", [{"menu_item_id": ids[0], "quantity": 1}],
        )).json()
        r = requests.get(f"{API}/orders?active_only=true", headers=admin_headers)
        assert r.status_code == 200
        ids_returned = {o["id"] for o in r.json()}
        assert cr["id"] in ids_returned

    def test_payment_with_discount_and_split(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "PayGuest", [{"menu_item_id": ids[0], "quantity": 2}], walk_in=True,
        )).json()
        oid = cr["id"]
        subtotal = cr["subtotal"]
        discount = 20.0
        due = round(subtotal - discount, 2)
        r = requests.patch(f"{API}/orders/{oid}/payment", headers=admin_headers, json={
            "discount_amount": discount,
            "discount_reason": "loyalty",
            "payment_status": "paid",
            "cash_amount": round(due / 2, 2),
            "upi_amount": round(due / 2, 2),
        })
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["payment_status"] == "paid"
        assert o["discount_amount"] == discount
        assert o["total"] == due
        assert o["cash_amount"] + o["upi_amount"] == due

    def test_payment_split_mismatch(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "BadPay", [{"menu_item_id": ids[0], "quantity": 1}],
        )).json()
        r = requests.patch(f"{API}/orders/{cr['id']}/payment", headers=admin_headers, json={
            "payment_status": "paid",
            "cash_amount": 1,
            "upi_amount": 1,
        })
        assert r.status_code == 400

    def test_update_order(self, admin_headers):
        ids = self._menu_ids(admin_headers, 2)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "Before", [{"menu_item_id": ids[0], "quantity": 1}], walk_in=True,
        )).json()
        r = requests.patch(f"{API}/orders/{cr['id']}", headers=admin_headers, json={
            "guest_name": "After",
            "notes": "no onion",
            "items": [
                {"menu_item_id": ids[0], "quantity": 2},
                {"menu_item_id": ids[1], "quantity": 1},
            ],
        })
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["guest_name"] == "After"
        assert o["notes"] == "no onion"
        assert len(o["items"]) == 2
        assert o["subtotal"] > cr["subtotal"]

    def test_update_order_staff(self, staff_user, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "StaffEdit", [{"menu_item_id": ids[0], "quantity": 1}],
        )).json()
        r = requests.patch(f"{API}/orders/{cr['id']}", headers=staff_user["headers"], json={
            "guest_name": "Staff Fixed",
        })
        assert r.status_code == 200
        assert r.json()["guest_name"] == "Staff Fixed"

    def test_delete_order_staff(self, staff_user, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "ToDelete", [{"menu_item_id": ids[0], "quantity": 1}],
        )).json()
        dr = requests.delete(f"{API}/orders/{cr['id']}", headers=staff_user["headers"])
        assert dr.status_code == 200
        gr = requests.get(f"{API}/orders/{cr['id']}", headers=admin_headers)
        assert gr.status_code == 404

    def test_edit_paid_order_resets_payment(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        cr = requests.post(f"{API}/orders", headers=admin_headers, json=self._order(
            "PaidEdit", [{"menu_item_id": ids[0], "quantity": 1}],
        )).json()
        due = cr["total"]
        requests.patch(f"{API}/orders/{cr['id']}/payment", headers=admin_headers, json={
            "payment_status": "paid", "cash_amount": due, "upi_amount": 0,
        })
        r = requests.patch(f"{API}/orders/{cr['id']}", headers=admin_headers, json={
            "items": [{"menu_item_id": ids[0], "quantity": 3}],
        })
        assert r.status_code == 200
        o = r.json()
        assert o["payment_status"] == "pending"
        assert o["cash_amount"] == 0

    def test_guest_ledger_and_settle(self, admin_headers):
        ids = self._menu_ids(admin_headers, 1)
        mobile = "9123456789"
        for _ in range(2):
            requests.post(f"{API}/orders", headers=admin_headers, json={
                "guest_name": "LedgerGuest",
                "guest_mobile": mobile,
                "room_number": "204",
                "items": [{"menu_item_id": ids[0], "quantity": 1}],
            })
        lr = requests.get(f"{API}/guests/ledger", headers=admin_headers, params={"payment_status": "pending"})
        assert lr.status_code == 200
        entry = next((g for g in lr.json() if g["guest_mobile"] == mobile), None)
        assert entry is not None
        assert entry["order_count"] >= 2
        assert entry["amount_due"] > 0

        br = requests.get(f"{API}/guests/{mobile}/bill", headers=admin_headers)
        assert br.status_code == 200
        bill = br.json()
        due = bill["amount_due"]

        sr = requests.post(f"{API}/guests/{mobile}/settle", headers=admin_headers, json={
            "payment_status": "paid",
            "cash_amount": due,
            "upi_amount": 0,
        })
        assert sr.status_code == 200, sr.text
        br2 = requests.get(f"{API}/guests/{mobile}/bill", headers=admin_headers)
        assert br2.status_code == 404


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_dashboard_today(self, admin_headers):
        r = requests.get(f"{API}/dashboard?range=today", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "total_orders" in d
        assert "revenue_served" in d
        assert "revenue_collected" in d
        assert "cash_collected" in d
        assert "upi_collected" in d
        assert "discount_total" in d
        assert "pending_count" in d
        assert "payment_counts" in d
        assert "status_counts" in d
        assert "top_items" in d

    def test_dashboard_invalid_range(self, admin_headers):
        r = requests.get(f"{API}/dashboard?range=bogus", headers=admin_headers)
        assert r.status_code == 400

    def test_dashboard_requires_admin(self, staff_user):
        r = requests.get(f"{API}/dashboard?range=today", headers=staff_user["headers"])
        assert r.status_code == 403


# ---------------- SUPPLY ----------------
class TestSupply:
    def test_add_and_list(self, admin_headers):
        r = requests.post(f"{API}/supply", headers=admin_headers, json={"item_name": "TEST_Spice"})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/supply", headers=admin_headers)
        assert r2.status_code == 200
        assert any(s["item_name"] == "TEST_Spice" for s in r2.json())

    def test_aggregated_admin_only(self, staff_user):
        r = requests.get(f"{API}/supply/aggregated", headers=staff_user["headers"])
        assert r.status_code == 403


# ---------------- TEAM ----------------
class TestTeam:
    def test_create_and_delete_user(self, admin_headers):
        mobile = f"9{int(time.time()) % 1000000000:09d}"
        cr = requests.post(f"{API}/auth/users", headers=admin_headers, json={
            "mobile": mobile, "name": "TEST_Temp", "password": "4321", "role": "staff"
        })
        assert cr.status_code == 200, cr.text
        uid = cr.json()["id"]
        dr = requests.delete(f"{API}/auth/users/{uid}", headers=admin_headers)
        assert dr.status_code == 200

    def test_staff_cannot_create_user(self, staff_user):
        r = requests.post(f"{API}/auth/users", headers=staff_user["headers"], json={
            "mobile": "9111111111", "name": "X", "password": "4321", "role": "staff"
        })
        assert r.status_code == 403

    def test_staff_login(self, staff_user):
        r = requests.post(f"{API}/auth/staff-login", json={"passcode": staff_user["passcode"]})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "staff"

    def test_staff_login_wrong_passcode(self):
        r = requests.post(f"{API}/auth/staff-login", json={"passcode": "0000"})
        assert r.status_code == 401

    def test_set_staff_passcode(self, admin_headers):
        r = requests.patch(f"{API}/auth/staff-passcode", headers=admin_headers, json={"passcode": "9876"})
        assert r.status_code == 200
        lr = requests.post(f"{API}/auth/staff-login", json={"passcode": "9876"})
        assert lr.status_code == 200
        # restore
        requests.patch(f"{API}/auth/staff-passcode", headers=admin_headers, json={"passcode": STAFF_PASSCODE})

    def test_staff_passcode_validation(self, admin_headers):
        r = requests.patch(f"{API}/auth/staff-passcode", headers=admin_headers, json={"passcode": "abc"})
        assert r.status_code == 400

    def test_staff_passcode_requires_admin(self, staff_user):
        r = requests.patch(f"{API}/auth/staff-passcode", headers=staff_user["headers"], json={"passcode": "4321"})
        assert r.status_code == 403

    def test_staff_passcode_validation_on_create(self, admin_headers):
        mobile = f"9{int(time.time()) % 1000000000:09d}"
        r = requests.post(f"{API}/auth/users", headers=admin_headers, json={
            "mobile": mobile, "name": "BadPass", "password": "abc", "role": "staff"
        })
        assert r.status_code == 400
