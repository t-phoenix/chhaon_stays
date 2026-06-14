from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated, Any

import bcrypt
import jwt
from bson import ObjectId
from pymongo import ReturnDocument
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator

# -------------------- DB --------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# -------------------- App --------------------
app = FastAPI(title="Chhaon Cafe Ops")
api_router = APIRouter(prefix="/api")

# -------------------- Models --------------------
def _validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    mobile: str
    name: str
    role: str  # 'admin' | 'staff'


class LoginPayload(BaseModel):
    mobile: str
    password: str


class StaffLoginPayload(BaseModel):
    passcode: str


class StaffPasscodePayload(BaseModel):
    passcode: str


class MeshPinPayload(BaseModel):
    pin: str


class MeshOpIn(BaseModel):
    opId: str
    deviceId: str
    lamport: int
    entity: str
    entityId: str
    action: str
    payload: dict = {}
    ts: Optional[str] = None
    meshPin: Optional[str] = None


class MeshOpsBatch(BaseModel):
    ops: List[MeshOpIn]


class LoginOut(BaseModel):
    user: UserOut


class CreateUserPayload(BaseModel):
    mobile: str
    name: str
    password: str
    role: str = "staff"


class UpdatePasscodePayload(BaseModel):
    passcode: str


class MenuItemIn(BaseModel):
    name: str
    category: str
    price: float
    active: bool = True


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    active: Optional[bool] = None


class MenuItemOut(BaseModel):
    id: str
    name: str
    category: str
    price: float
    active: bool


class OrderItemIn(BaseModel):
    line_id: Optional[str] = None
    menu_item_id: Optional[str] = None
    custom_name: Optional[str] = None
    custom_price: Optional[float] = None
    quantity: int = 1


class OrderCreate(BaseModel):
    client_id: Optional[str] = None
    guest_name: str
    guest_mobile: str
    room_number: Optional[str] = None
    walk_in: bool = False
    notes: Optional[str] = ""
    items: List[OrderItemIn]


class OrderUpdate(BaseModel):
    guest_name: Optional[str] = None
    guest_mobile: Optional[str] = None
    room_number: Optional[str] = None
    walk_in: Optional[bool] = None
    notes: Optional[str] = None
    items: Optional[List[OrderItemIn]] = None


class OrderItemsAppend(BaseModel):
    items: List[OrderItemIn]


class OrderItemOut(BaseModel):
    line_id: str
    menu_item_id: str
    name: str
    category: str
    price: float
    quantity: int
    line_total: float
    status: str
    is_misc: bool = False


class OrderOut(BaseModel):
    id: str
    order_no: int
    guest_name: str
    guest_mobile: Optional[str] = None
    room_number: Optional[str] = None
    walk_in: bool
    notes: str = ""
    items: List[OrderItemOut]
    status: str
    subtotal: float
    discount_amount: float = 0
    discount_reason: str = ""
    total: float
    payment_status: str = "pending"
    cash_amount: float = 0
    upi_amount: float = 0
    paid_at: Optional[str] = None
    created_at: str
    updated_at: str
    created_by_name: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str  # new | preparing | ready | served


class ItemStatusUpdate(BaseModel):
    status: str  # new | preparing | ready | served


class PaymentUpdate(BaseModel):
    discount_amount: Optional[float] = None
    discount_reason: Optional[str] = None
    payment_status: Optional[str] = None  # pending | paid
    cash_amount: Optional[float] = None
    upi_amount: Optional[float] = None


class GuestLedgerEntry(BaseModel):
    guest_mobile: str
    guest_name: str
    room_number: Optional[str] = None
    walk_in: bool = False
    order_count: int
    active_items: int
    subtotal: float
    amount_due: float
    first_order_at: str
    last_order_at: str


class GuestBillOut(BaseModel):
    guest_mobile: str
    guest_name: str
    room_number: Optional[str] = None
    walk_in: bool = False
    orders: List[OrderOut]
    subtotal: float
    discount_total: float
    amount_due: float
    order_count: int


class GuestSettlePayload(BaseModel):
    discount_amount: float = 0
    discount_reason: str = ""
    payment_status: str = "paid"
    cash_amount: float = 0
    upi_amount: float = 0


class SupplyRequestIn(BaseModel):
    item_name: str


class SupplyRequestOut(BaseModel):
    id: str
    item_name: str
    requested_by_id: str
    requested_by_name: str
    created_at: str


VALID_STATUSES = {"new", "preparing", "ready", "served"}
VALID_PAYMENT_STATUSES = {"pending", "paid"}
STAFF_SESSION_MOBILE = "0000000001"
STAFF_SESSION_NAME = "Staff"

# -------------------- Auth helpers --------------------
JWT_ALG = "HS256"
# -------------------- CORS / cookies --------------------
def _parse_cors_origins() -> list[str]:
    """Comma-separated origins; strips whitespace and stray quotes from .env."""
    raw = os.environ.get("CORS_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    origins = []
    for part in raw.split(","):
        origin = part.strip().strip('"').strip("'")
        if origin:
            origins.append(origin)
    return origins or ["*"]


COOKIE_NAME = os.environ.get("COOKIE_NAME", "chhaon_access")
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
# Cross-origin SPA (e.g. Vercel → Render) requires SameSite=none + Secure for credentialed XHR.
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax").lower()
if COOKIE_SAMESITE not in ("lax", "strict", "none"):
    COOKIE_SAMESITE = "lax"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def _create_access_token(user_id: str, mobile: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "mobile": mobile,
        "role": role,
        "exp": _now() + timedelta(days=30),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    # Prefer httpOnly cookie; fall back to Bearer header for tests / API clients
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALG])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


async def require_admin(user=Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _user_out(u: dict) -> UserOut:
    return UserOut(
        id=str(u["_id"]),
        mobile=u["mobile"],
        name=u["name"],
        role=u["role"],
    )


def _menu_out(m: dict) -> MenuItemOut:
    return MenuItemOut(
        id=str(m["_id"]),
        name=m["name"],
        category=m["category"],
        price=float(m["price"]),
        active=bool(m.get("active", True)),
    )


def _derive_order_status(items: list) -> str:
    if not items:
        return "new"
    statuses = [it.get("status", "new") for it in items]
    if all(s == "served" for s in statuses):
        return "served"
    if any(s == "ready" for s in statuses):
        return "ready"
    if any(s == "preparing" for s in statuses):
        return "preparing"
    return "new"


def _enrich_order_items(items: list, fallback_status: str = "new") -> list:
    enriched = []
    for it in items or []:
        copy = dict(it)
        copy["line_id"] = copy.get("line_id") or str(uuid.uuid4())
        copy["status"] = copy.get("status") or fallback_status
        copy["is_misc"] = bool(copy.get("is_misc", copy.get("menu_item_id", "").startswith("misc")))
        if not copy.get("menu_item_id"):
            copy["menu_item_id"] = f"misc_{copy['line_id'][:8]}"
        enriched.append(copy)
    return enriched


def _order_has_active_items(o: dict) -> bool:
    items = _enrich_order_items(o.get("items", []), o.get("status", "new"))
    return any(it.get("status") in {"new", "preparing", "ready"} for it in items)


def _order_out(o: dict) -> OrderOut:
    items = _enrich_order_items(o.get("items", []), o.get("status", "new"))
    derived_status = _derive_order_status(items)
    subtotal = float(o.get("subtotal", o.get("total", 0)))
    discount = float(o.get("discount_amount", 0))
    return OrderOut(
        id=str(o["_id"]),
        order_no=int(o["order_no"]),
        guest_name=o["guest_name"],
        guest_mobile=o.get("guest_mobile"),
        room_number=o.get("room_number"),
        walk_in=bool(o.get("walk_in", False)),
        notes=o.get("notes") or "",
        items=[OrderItemOut(**it) for it in items],
        status=derived_status,
        subtotal=subtotal,
        discount_amount=discount,
        discount_reason=o.get("discount_reason") or "",
        total=float(o.get("total", subtotal - discount)),
        payment_status=o.get("payment_status", "pending"),
        cash_amount=float(o.get("cash_amount", 0)),
        upi_amount=float(o.get("upi_amount", 0)),
        paid_at=o.get("paid_at"),
        created_at=o["created_at"],
        updated_at=o["updated_at"],
        created_by_name=o.get("created_by_name"),
    )


def _supply_out(s: dict) -> SupplyRequestOut:
    return SupplyRequestOut(
        id=str(s["_id"]),
        item_name=s["item_name"],
        requested_by_id=str(s["requested_by_id"]),
        requested_by_name=s["requested_by_name"],
        created_at=s["created_at"],
    )


def _normalize_mobile(m: str) -> str:
    digits = re.sub(r"\D", "", m or "")
    # Strip country code 91 if present (Indian context)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits[:10]


def _require_guest_mobile(m: Optional[str]) -> str:
    mobile = _normalize_mobile(m or "")
    if len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Guest mobile must be 10 digits")
    return mobile


def _validate_staff_passcode(passcode: str) -> None:
    if not re.fullmatch(r"\d{4,6}", passcode or ""):
        raise HTTPException(status_code=400, detail="Staff passcode must be 4–6 digits")


def _validate_user_password(password: str, role: str) -> None:
    if role == "staff":
        _validate_staff_passcode(password)
    elif not password or len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")


async def _get_settings() -> dict:
    doc = await db.settings.find_one({"_id": "app"})
    return doc or {}


async def _get_staff_session_user() -> dict:
    user = await db.users.find_one({"mobile": STAFF_SESSION_MOBILE})
    if not user:
        raise HTTPException(status_code=500, detail="Staff session user not configured")
    return user


async def _verify_staff_passcode(passcode: str) -> bool:
    settings = await _get_settings()
    h = settings.get("staff_passcode_hash")
    if not h:
        return False
    return _verify_password(passcode, h)


# -------------------- Auth routes --------------------
@api_router.post("/auth/login", response_model=LoginOut)
async def login(payload: LoginPayload, response: Response):
    mobile = _normalize_mobile(payload.mobile)
    if not mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")
    user = await db.users.find_one({"mobile": mobile})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid mobile or password")
    token = _create_access_token(str(user["_id"]), user["mobile"], user["role"])
    _set_auth_cookie(response, token)
    return LoginOut(user=_user_out(user))


@api_router.post("/auth/staff-login", response_model=LoginOut)
async def staff_login(payload: StaffLoginPayload, response: Response):
    _validate_staff_passcode(payload.passcode)
    if not await _verify_staff_passcode(payload.passcode):
        raise HTTPException(status_code=401, detail="Invalid passcode")
    user = await _get_staff_session_user()
    token = _create_access_token(str(user["_id"]), user["mobile"], user["role"])
    _set_auth_cookie(response, token)
    return LoginOut(user=_user_out(user))


@api_router.get("/auth/staff-passcode")
async def get_staff_passcode_status(_admin=Depends(require_admin)):
    settings = await _get_settings()
    return {"configured": bool(settings.get("staff_passcode_hash"))}


@api_router.patch("/auth/staff-passcode")
async def set_staff_passcode(payload: StaffPasscodePayload, _admin=Depends(require_admin)):
    _validate_staff_passcode(payload.passcode)
    await db.settings.update_one(
        {"_id": "app"},
        {"$set": {"staff_passcode_hash": _hash_password(payload.passcode), "updated_at": _now().isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/auth/mesh-pin")
async def get_mesh_pin(user=Depends(get_current_user)):
    settings = await _get_settings()
    pin = settings.get("mesh_pin") or ""
    return {"pin": pin, "configured": bool(pin)}


@api_router.patch("/auth/mesh-pin")
async def set_mesh_pin(payload: MeshPinPayload, _admin=Depends(require_admin)):
    pin = re.sub(r"[^a-zA-Z0-9]", "", (payload.pin or "").strip())[:12]
    if len(pin) < 4:
        raise HTTPException(status_code=400, detail="Mesh PIN must be at least 4 characters")
    await db.settings.update_one(
        {"_id": "app"},
        {"$set": {"mesh_pin": pin, "mesh_pin_updated_at": _now().isoformat()}},
        upsert=True,
    )
    return {"ok": True, "pin": pin}


@api_router.post("/auth/logout")
async def logout(response: Response, _user=Depends(get_current_user)):
    _clear_auth_cookie(response)
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return _user_out(user)


@api_router.get("/auth/users", response_model=List[UserOut])
async def list_users(_admin=Depends(require_admin)):
    docs = await db.users.find().sort("created_at", 1).to_list(500)
    return [_user_out(u) for u in docs]


@api_router.post("/auth/users", response_model=UserOut)
async def create_user(payload: CreateUserPayload, _admin=Depends(require_admin)):
    mobile = _normalize_mobile(payload.mobile)
    if len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Mobile must be 10 digits")
    if payload.role not in {"admin", "staff"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    _validate_user_password(payload.password, payload.role)
    existing = await db.users.find_one({"mobile": mobile})
    if existing:
        raise HTTPException(status_code=409, detail="Mobile already registered")
    doc = {
        "mobile": mobile,
        "name": payload.name.strip(),
        "password_hash": _hash_password(payload.password),
        "role": payload.role,
        "created_at": _now().isoformat(),
    }
    res = await db.users.insert_one(doc)
    user = await db.users.find_one({"_id": res.inserted_id})
    return _user_out(user)


@api_router.delete("/auth/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if str(admin["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    res = await db.users.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@api_router.patch("/auth/users/{user_id}/passcode", response_model=UserOut)
async def update_staff_passcode(user_id: str, payload: UpdatePasscodePayload, _admin=Depends(require_admin)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") != "staff":
        raise HTTPException(status_code=400, detail="Passcode can only be set for staff users")
    _validate_staff_passcode(payload.passcode)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": _hash_password(payload.passcode)}},
    )
    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    return _user_out(updated)


# -------------------- Menu routes --------------------
@api_router.get("/menu", response_model=List[MenuItemOut])
async def list_menu(active_only: bool = False, _user=Depends(get_current_user)):
    q: dict = {}
    if active_only:
        q["active"] = True
    docs = await db.menu_items.find(q).sort([("category", 1), ("name", 1)]).to_list(1000)
    return [_menu_out(m) for m in docs]


@api_router.post("/menu", response_model=MenuItemOut)
async def create_menu_item(payload: MenuItemIn, _admin=Depends(require_admin)):
    doc = {
        "name": payload.name.strip(),
        "category": payload.category.strip(),
        "price": float(payload.price),
        "active": bool(payload.active),
        "created_at": _now().isoformat(),
    }
    res = await db.menu_items.insert_one(doc)
    item = await db.menu_items.find_one({"_id": res.inserted_id})
    return _menu_out(item)


@api_router.patch("/menu/{item_id}", response_model=MenuItemOut)
async def update_menu_item(item_id: str, payload: MenuItemUpdate, _admin=Depends(require_admin)):
    update: dict = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "price" in update:
        update["price"] = float(update["price"])
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.menu_items.update_one({"_id": ObjectId(item_id)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
    return _menu_out(item)


@api_router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, _admin=Depends(require_admin)):
    res = await db.menu_items.delete_one({"_id": ObjectId(item_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# -------------------- Order helpers --------------------
async def _resolve_order_items(
    items: List[OrderItemIn],
    existing_items: Optional[List[dict]] = None,
) -> tuple[List[dict], float]:
    existing_by_line = {
        it["line_id"]: it for it in (existing_items or []) if it.get("line_id")
    }
    items_out: List[dict] = []
    subtotal = 0.0
    for it in items:
        qty = int(it.quantity)
        if qty <= 0:
            continue

        line_id = it.line_id or str(uuid.uuid4())
        prev = existing_by_line.get(line_id, {})
        status = prev.get("status", "new")

        if it.menu_item_id:
            m = await db.menu_items.find_one({"_id": ObjectId(it.menu_item_id)})
            if not m:
                raise HTTPException(status_code=400, detail=f"Menu item not found: {it.menu_item_id}")
            price = float(m["price"])
            line_total = round(price * qty, 2)
            subtotal += line_total
            items_out.append({
                "line_id": line_id,
                "menu_item_id": str(m["_id"]),
                "name": m["name"],
                "category": m["category"],
                "price": price,
                "quantity": qty,
                "line_total": line_total,
                "status": status,
                "is_misc": False,
            })
        elif it.custom_name and it.custom_price is not None:
            name = it.custom_name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="Misc item name is required")
            price = float(it.custom_price)
            if price < 0:
                raise HTTPException(status_code=400, detail="Misc item price cannot be negative")
            line_total = round(price * qty, 2)
            subtotal += line_total
            items_out.append({
                "line_id": line_id,
                "menu_item_id": f"misc_{line_id[:8]}",
                "name": name,
                "category": "Miscellaneous",
                "price": price,
                "quantity": qty,
                "line_total": line_total,
                "status": status,
                "is_misc": True,
            })
        else:
            raise HTTPException(
                status_code=400,
                detail="Each item needs menu_item_id or custom_name + custom_price",
            )

    if not items_out:
        raise HTTPException(status_code=400, detail="Order must have at least 1 item with quantity > 0")
    return items_out, round(subtotal, 2)


async def _next_order_no() -> int:
    today_key = _now().strftime("%Y-%m-%d")
    res = await db.counters.find_one_and_update(
        {"_id": f"order_{today_key}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if res and "seq" in res:
        return int(res["seq"])
    doc = await db.counters.find_one({"_id": f"order_{today_key}"})
    return int(doc["seq"]) if doc else 1


# -------------------- Order routes --------------------
@api_router.post("/orders", response_model=OrderOut)
async def create_order(payload: OrderCreate, user=Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must have at least 1 item")
    if not payload.guest_name.strip():
        raise HTTPException(status_code=400, detail="Guest name is required")
    guest_mobile = _require_guest_mobile(payload.guest_mobile)

    if payload.client_id:
        existing = await db.orders.find_one({"client_id": payload.client_id})
        if existing:
            return _order_out(existing)

    items_out, subtotal = await _resolve_order_items(payload.items)

    order_no = await _next_order_no()
    now = _now().isoformat()
    doc = {
        "client_id": payload.client_id,
        "order_no": order_no,
        "guest_name": payload.guest_name.strip(),
        "guest_mobile": guest_mobile,
        "room_number": (payload.room_number or "").strip() or None,
        "walk_in": bool(payload.walk_in),
        "notes": (payload.notes or "").strip(),
        "items": items_out,
        "status": "new",
        "subtotal": subtotal,
        "discount_amount": 0.0,
        "discount_reason": "",
        "total": subtotal,
        "payment_status": "pending",
        "cash_amount": 0.0,
        "upi_amount": 0.0,
        "paid_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by_id": str(user["_id"]),
        "created_by_name": user.get("name", ""),
        "history": [{"status": "new", "at": now, "by": user.get("name", "")}],
    }
    res = await db.orders.insert_one(doc)
    saved = await db.orders.find_one({"_id": res.inserted_id})
    return _order_out(saved)


@api_router.get("/orders", response_model=List[OrderOut])
async def list_orders(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    active_only: bool = False,
    guest_name: Optional[str] = None,
    guest_mobile: Optional[str] = None,
    limit: int = 200,
    _user=Depends(get_current_user),
):
    q: dict = {}
    if status:
        q["status"] = status
    if payment_status:
        if payment_status not in VALID_PAYMENT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid payment_status")
        q["payment_status"] = payment_status
    if guest_name:
        q["guest_name"] = {"$regex": f"^{re.escape(guest_name.strip())}$", "$options": "i"}
    if guest_mobile:
        q["guest_mobile"] = _normalize_mobile(guest_mobile)
    docs = await db.orders.find(q).sort("created_at", -1).to_list(limit)
    if active_only:
        docs = [o for o in docs if _order_has_active_items(o)]
    return [_order_out(o) for o in docs]


@api_router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, _user=Depends(get_current_user)):
    o = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_out(o)


@api_router.patch("/orders/{order_id}", response_model=OrderOut)
async def update_order(order_id: str, payload: OrderUpdate, user=Depends(get_current_user)):
    o = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    update_fields: dict = {}
    now = _now().isoformat()
    old_subtotal = float(o.get("subtotal", o.get("total", 0)))

    if payload.guest_name is not None:
        name = payload.guest_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Guest name is required")
        update_fields["guest_name"] = name
    if payload.guest_mobile is not None:
        update_fields["guest_mobile"] = _require_guest_mobile(payload.guest_mobile)
    if payload.walk_in is not None:
        update_fields["walk_in"] = bool(payload.walk_in)
        if payload.walk_in:
            update_fields["room_number"] = None
    if payload.room_number is not None and not update_fields.get("walk_in", o.get("walk_in")):
        update_fields["room_number"] = payload.room_number.strip() or None
    if payload.notes is not None:
        update_fields["notes"] = payload.notes.strip()

    items_changed = False
    if payload.items is not None:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Order must have at least 1 item")
        existing = _enrich_order_items(o.get("items", []), o.get("status", "new"))
        items_out, subtotal = await _resolve_order_items(payload.items, existing_items=existing)
        update_fields["items"] = items_out
        update_fields["subtotal"] = subtotal
        update_fields["status"] = _derive_order_status(items_out)
        items_changed = subtotal != old_subtotal

    discount = float(o.get("discount_amount", 0))
    if items_changed:
        discount = min(discount, float(update_fields.get("subtotal", old_subtotal)))
        update_fields["discount_amount"] = round(discount, 2)
        new_subtotal = float(update_fields.get("subtotal", old_subtotal))
        update_fields["total"] = round(new_subtotal - discount, 2)

    payment_changed = items_changed and (
        o.get("payment_status") == "paid"
        or float(o.get("total", 0)) != float(update_fields.get("total", o.get("total", 0)))
    )
    if payment_changed:
        update_fields["payment_status"] = "pending"
        update_fields["cash_amount"] = 0.0
        update_fields["upi_amount"] = 0.0
        update_fields["paid_at"] = None

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = now
    update_fields["last_edited_by"] = user.get("name", "")

    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_fields})
    updated = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _order_out(updated)


@api_router.patch("/orders/{order_id}/status", response_model=OrderOut)
async def update_order_status(order_id: str, payload: StatusUpdate, user=Depends(get_current_user)):
    status = payload.status.lower()
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    o = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    now = _now().isoformat()
    items = _enrich_order_items(o.get("items", []), o.get("status", "new"))
    for it in items:
        if status == "served" or it.get("status") != "served":
            it["status"] = status
    update = {
        "$set": {
            "status": _derive_order_status(items),
            "items": items,
            "updated_at": now,
        },
        "$push": {"history": {"status": status, "at": now, "by": user.get("name", ""), "scope": "order"}},
    }
    if status == "served":
        update["$set"]["served_at"] = now
    await db.orders.update_one({"_id": ObjectId(order_id)}, update)
    saved = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _order_out(saved)


@api_router.patch("/orders/{order_id}/items/{line_id}/status", response_model=OrderOut)
async def update_order_item_status(
    order_id: str,
    line_id: str,
    payload: ItemStatusUpdate,
    user=Depends(get_current_user),
):
    status = payload.status.lower()
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    o = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    items = _enrich_order_items(o.get("items", []), o.get("status", "new"))
    found = False
    for it in items:
        if it["line_id"] == line_id:
            it["status"] = status
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Order item not found")
    now = _now().isoformat()
    derived = _derive_order_status(items)
    update_fields = {"items": items, "status": derived, "updated_at": now}
    if derived == "served":
        update_fields["served_at"] = now
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": update_fields,
            "$push": {
                "history": {
                    "status": status,
                    "at": now,
                    "by": user.get("name", ""),
                    "scope": "item",
                    "line_id": line_id,
                }
            },
        },
    )
    saved = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _order_out(saved)


@api_router.post("/orders/{order_id}/items", response_model=OrderOut)
async def append_order_items(order_id: str, payload: OrderItemsAppend, user=Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least 1 item")
    o = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    existing = _enrich_order_items(o.get("items", []), o.get("status", "new"))
    new_items, added_subtotal = await _resolve_order_items(payload.items)
    merged = existing + new_items
    subtotal = round(float(o.get("subtotal", 0)) + added_subtotal, 2)
    discount = float(o.get("discount_amount", 0))
    discount = min(discount, subtotal)
    now = _now().isoformat()
    update_fields = {
        "items": merged,
        "subtotal": subtotal,
        "total": round(subtotal - discount, 2),
        "status": _derive_order_status(merged),
        "updated_at": now,
        "last_edited_by": user.get("name", ""),
    }
    if o.get("payment_status") == "paid":
        update_fields["payment_status"] = "pending"
        update_fields["cash_amount"] = 0.0
        update_fields["upi_amount"] = 0.0
        update_fields["paid_at"] = None
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_fields})
    saved = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _order_out(saved)


@api_router.patch("/orders/{order_id}/payment", response_model=OrderOut)
async def update_order_payment(order_id: str, payload: PaymentUpdate, user=Depends(get_current_user)):
    o = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    subtotal = float(o.get("subtotal", o.get("total", 0)))
    discount = float(payload.discount_amount) if payload.discount_amount is not None else float(o.get("discount_amount", 0))
    if discount < 0:
        raise HTTPException(status_code=400, detail="Discount cannot be negative")
    if discount > subtotal:
        raise HTTPException(status_code=400, detail="Discount cannot exceed subtotal")

    amount_due = round(subtotal - discount, 2)
    payment_status = (payload.payment_status or o.get("payment_status", "pending")).lower()
    if payment_status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid payment_status")

    cash = float(payload.cash_amount) if payload.cash_amount is not None else float(o.get("cash_amount", 0))
    upi = float(payload.upi_amount) if payload.upi_amount is not None else float(o.get("upi_amount", 0))
    if cash < 0 or upi < 0:
        raise HTTPException(status_code=400, detail="Payment amounts cannot be negative")

    if payment_status == "paid":
        paid_total = round(cash + upi, 2)
        if abs(paid_total - amount_due) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Cash + UPI (₹{paid_total}) must equal amount due (₹{amount_due})",
            )
    else:
        cash = 0.0
        upi = 0.0

    now = _now().isoformat()
    update_fields = {
        "discount_amount": round(discount, 2),
        "discount_reason": (payload.discount_reason if payload.discount_reason is not None else o.get("discount_reason") or "").strip(),
        "total": amount_due,
        "payment_status": payment_status,
        "cash_amount": round(cash, 2),
        "upi_amount": round(upi, 2),
        "updated_at": now,
        "payment_updated_by": user.get("name", ""),
    }
    if payment_status == "paid":
        update_fields["paid_at"] = now
    else:
        update_fields["paid_at"] = None

    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_fields})
    updated = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _order_out(updated)


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, _user=Depends(get_current_user)):
    res = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


def _order_amount_due(o: dict) -> float:
    subtotal = float(o.get("subtotal", o.get("total", 0)))
    discount = float(o.get("discount_amount", 0))
    return round(max(0, subtotal - discount), 2)


def _aggregate_guest_ledger(orders: list) -> List[GuestLedgerEntry]:
    groups: dict = {}
    for o in orders:
        mobile = o.get("guest_mobile") or ""
        if not mobile:
            continue
        if mobile not in groups:
            groups[mobile] = {
                "guest_mobile": mobile,
                "guest_name": o.get("guest_name", ""),
                "room_number": o.get("room_number"),
                "walk_in": bool(o.get("walk_in")),
                "order_count": 0,
                "active_items": 0,
                "subtotal": 0.0,
                "amount_due": 0.0,
                "first_order_at": o.get("created_at", ""),
                "last_order_at": o.get("created_at", ""),
            }
        g = groups[mobile]
        g["order_count"] += 1
        g["subtotal"] += float(o.get("subtotal", o.get("total", 0)))
        g["amount_due"] += _order_amount_due(o)
        g["active_items"] += sum(
            1 for it in o.get("items", []) if (it.get("status") or "new") != "served"
        )
        if o.get("guest_name"):
            g["guest_name"] = o["guest_name"]
        if o.get("room_number"):
            g["room_number"] = o["room_number"]
        g["walk_in"] = bool(o.get("walk_in"))
        created = o.get("created_at", "")
        if created and created < g["first_order_at"]:
            g["first_order_at"] = created
        if created and created > g["last_order_at"]:
            g["last_order_at"] = created
    out = [GuestLedgerEntry(**v) for v in groups.values()]
    out.sort(key=lambda x: x.last_order_at, reverse=True)
    return out


@api_router.get("/guests/ledger", response_model=List[GuestLedgerEntry])
async def guest_ledger(
    payment_status: str = "pending",
    limit: int = 200,
    _user=Depends(get_current_user),
):
    if payment_status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid payment_status")
    q = {"payment_status": payment_status, "guest_mobile": {"$regex": r"^\d{10}$"}}
    docs = await db.orders.find(q).sort("created_at", -1).to_list(limit * 5)
    return _aggregate_guest_ledger(docs)[:limit]


@api_router.get("/guests/{mobile}/bill", response_model=GuestBillOut)
async def guest_bill(
    mobile: str,
    payment_status: str = "pending",
    days: int = Query(90, le=365),
    _user=Depends(get_current_user),
):
    norm = _require_guest_mobile(mobile)
    if payment_status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid payment_status")
    since = (_now() - timedelta(days=days)).isoformat()
    q = {
        "guest_mobile": norm,
        "payment_status": payment_status,
        "created_at": {"$gte": since},
    }
    docs = await db.orders.find(q).sort("created_at", 1).to_list(500)
    if not docs:
        raise HTTPException(status_code=404, detail="No open orders for this guest")
    orders_out = [_order_out(o) for o in docs]
    subtotal = sum(float(o.subtotal) for o in orders_out)
    discount_total = sum(float(o.discount_amount or 0) for o in orders_out)
    amount_due = sum(_order_amount_due(o) for o in docs)
    latest = docs[-1]
    return GuestBillOut(
        guest_mobile=norm,
        guest_name=latest.get("guest_name", ""),
        room_number=latest.get("room_number"),
        walk_in=bool(latest.get("walk_in")),
        orders=orders_out,
        subtotal=round(subtotal, 2),
        discount_total=round(discount_total, 2),
        amount_due=round(amount_due, 2),
        order_count=len(orders_out),
    )


@api_router.post("/guests/{mobile}/settle")
async def settle_guest_bill(mobile: str, payload: GuestSettlePayload, user=Depends(get_current_user)):
    norm = _require_guest_mobile(mobile)
    payment_status = (payload.payment_status or "paid").lower()
    if payment_status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid payment_status")

    docs = await db.orders.find({"guest_mobile": norm, "payment_status": "pending"}).sort("created_at", 1).to_list(500)
    if not docs:
        raise HTTPException(status_code=404, detail="No pending orders for this guest")

    subtotal_sum = sum(float(o.get("subtotal", o.get("total", 0))) for o in docs)
    existing_discount = sum(float(o.get("discount_amount", 0)) for o in docs)
    extra_discount = max(0, float(payload.discount_amount or 0))
    if extra_discount + existing_discount > subtotal_sum:
        raise HTTPException(status_code=400, detail="Discount cannot exceed subtotal")

    amount_due = round(subtotal_sum - existing_discount - extra_discount, 2)
    cash = max(0, float(payload.cash_amount or 0))
    upi = max(0, float(payload.upi_amount or 0))

    if payment_status == "paid":
        if abs(cash + upi - amount_due) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Cash + UPI (₹{round(cash + upi, 2)}) must equal amount due (₹{amount_due})",
            )

    now = _now().isoformat()
    updated_ids = []
    remaining_discount = extra_discount
    remaining_cash = cash
    remaining_upi = upi

    for i, o in enumerate(docs):
        o_sub = float(o.get("subtotal", o.get("total", 0)))
        o_existing_disc = float(o.get("discount_amount", 0))
        share = o_sub / subtotal_sum if subtotal_sum else 0
        o_extra_disc = round(extra_discount * share, 2) if i < len(docs) - 1 else remaining_discount
        remaining_discount = round(remaining_discount - o_extra_disc, 2)
        o_discount = round(o_existing_disc + o_extra_disc, 2)
        o_due = round(max(0, o_sub - o_discount), 2)

        o_cash = round(cash * (o_due / amount_due), 2) if payment_status == "paid" and amount_due and i < len(docs) - 1 else remaining_cash
        o_upi = round(upi * (o_due / amount_due), 2) if payment_status == "paid" and amount_due and i < len(docs) - 1 else remaining_upi
        if payment_status == "paid" and i < len(docs) - 1:
            remaining_cash = round(remaining_cash - o_cash, 2)
            remaining_upi = round(remaining_upi - o_upi, 2)

        upd = {
            "discount_amount": o_discount,
            "discount_reason": (payload.discount_reason or o.get("discount_reason") or "").strip(),
            "total": o_due,
            "payment_status": payment_status,
            "cash_amount": o_cash if payment_status == "paid" else 0.0,
            "upi_amount": o_upi if payment_status == "paid" else 0.0,
            "updated_at": now,
            "payment_updated_by": user.get("name", ""),
        }
        if payment_status == "paid":
            upd["paid_at"] = now
        else:
            upd["paid_at"] = None

        await db.orders.update_one({"_id": o["_id"]}, {"$set": upd})
        updated_ids.append(str(o["_id"]))

    return {"ok": True, "settled_orders": updated_ids, "amount_due": amount_due}


# -------------------- Dashboard --------------------
def _parse_date(d: str) -> datetime:
    return datetime.fromisoformat(d.replace("Z", "+00:00"))


def _resolve_range(range_: str, start: Optional[str], end: Optional[str], today_start: datetime) -> tuple:
    if range_ == "today":
        return today_start, today_start + timedelta(days=1)
    if range_ == "yesterday":
        return today_start - timedelta(days=1), today_start
    if range_ == "7d":
        return today_start - timedelta(days=6), today_start + timedelta(days=1)
    if range_ == "custom":
        if not start or not end:
            raise HTTPException(status_code=400, detail="custom range requires start and end")
        return _parse_date(start), _parse_date(end) + timedelta(days=1)
    raise HTTPException(status_code=400, detail="Invalid range")


def _summarize_orders(orders: list) -> dict:
    total_orders = len(orders)
    revenue_served = sum(float(o.get("total", 0)) for o in orders if o.get("status") == "served")
    revenue_total = sum(float(o.get("total", 0)) for o in orders)
    revenue_collected = sum(float(o.get("total", 0)) for o in orders if o.get("payment_status") == "paid")
    cash_collected = sum(float(o.get("cash_amount", 0)) for o in orders if o.get("payment_status") == "paid")
    upi_collected = sum(float(o.get("upi_amount", 0)) for o in orders if o.get("payment_status") == "paid")
    discount_total = sum(float(o.get("discount_amount", 0)) for o in orders)
    pending_orders = [o for o in orders if o.get("payment_status", "pending") != "paid"]
    pending_count = len(pending_orders)
    pending_total = sum(float(o.get("total", 0)) for o in pending_orders)
    aov = round(revenue_total / total_orders, 2) if total_orders else 0.0
    status_counts = {"new": 0, "preparing": 0, "ready": 0, "served": 0}
    payment_counts = {"pending": 0, "paid": 0}
    item_counts: dict = {}
    for o in orders:
        ps = o.get("payment_status", "pending")
        payment_counts[ps] = payment_counts.get(ps, 0) + 1
        enriched = _enrich_order_items(o.get("items", []), o.get("status", "new"))
        for it in enriched:
            s = it.get("status", "new")
            status_counts[s] = status_counts.get(s, 0) + 1
            item_counts[it["name"]] = item_counts.get(it["name"], 0) + int(it["quantity"])
    top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:8]
    return {
        "total_orders": total_orders,
        "revenue_served": round(revenue_served, 2),
        "revenue_total": round(revenue_total, 2),
        "revenue_collected": round(revenue_collected, 2),
        "cash_collected": round(cash_collected, 2),
        "upi_collected": round(upi_collected, 2),
        "discount_total": round(discount_total, 2),
        "pending_count": pending_count,
        "pending_total": round(pending_total, 2),
        "average_order_value": aov,
        "status_counts": status_counts,
        "payment_counts": payment_counts,
        "top_items": [{"name": n, "quantity": q} for n, q in top_items],
    }


@api_router.get("/dashboard")
async def dashboard(
    range: str = Query("today"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    _admin=Depends(require_admin),
):
    today_start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_dt, end_dt = _resolve_range(range, start, end, today_start)
    q = {"created_at": {"$gte": start_dt.isoformat(), "$lt": end_dt.isoformat()}}
    orders = await db.orders.find(q).sort("created_at", -1).to_list(5000)
    summary = _summarize_orders(orders)
    recent = [_order_out(o).model_dump() for o in orders[:10]]
    return {
        "range": range,
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        **summary,
        "recent_orders": recent,
    }


# -------------------- Supply --------------------
@api_router.post("/supply", response_model=SupplyRequestOut)
async def add_supply(payload: SupplyRequestIn, user=Depends(get_current_user)):
    name = payload.item_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Item name required")
    doc = {
        "item_name": name,
        "requested_by_id": str(user["_id"]),
        "requested_by_name": user.get("name", ""),
        "created_at": _now().isoformat(),
    }
    res = await db.supply_requests.insert_one(doc)
    s = await db.supply_requests.find_one({"_id": res.inserted_id})
    return _supply_out(s)


@api_router.get("/supply", response_model=List[SupplyRequestOut])
async def list_supply(_user=Depends(get_current_user), limit: int = 200):
    docs = await db.supply_requests.find().sort("created_at", -1).to_list(limit)
    return [_supply_out(s) for s in docs]


@api_router.get("/supply/aggregated")
async def supply_aggregated(_admin=Depends(require_admin)):
    docs = await db.supply_requests.find().sort("created_at", -1).to_list(2000)
    agg: dict = {}
    for s in docs:
        key = s["item_name"].lower().strip()
        if key not in agg:
            agg[key] = {
                "item_name": s["item_name"],
                "count": 0,
                "last_requested_at": s["created_at"],
                "last_requested_by": s["requested_by_name"],
                "requesters": set(),
            }
        agg[key]["count"] += 1
        agg[key]["requesters"].add(s["requested_by_name"])
        if s["created_at"] > agg[key]["last_requested_at"]:
            agg[key]["last_requested_at"] = s["created_at"]
            agg[key]["last_requested_by"] = s["requested_by_name"]
    out = []
    for v in agg.values():
        out.append({
            "item_name": v["item_name"],
            "count": v["count"],
            "last_requested_at": v["last_requested_at"],
            "last_requested_by": v["last_requested_by"],
            "requesters": sorted(list(v["requesters"])),
        })
    out.sort(key=lambda x: x["count"], reverse=True)
    return out


@api_router.delete("/supply/{request_id}")
async def delete_supply(request_id: str, _admin=Depends(require_admin)):
    res = await db.supply_requests.delete_one({"_id": ObjectId(request_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.delete("/supply")
async def clear_supply(item_name: Optional[str] = None, _admin=Depends(require_admin)):
    q: dict = {}
    if item_name:
        q = {"item_name": {"$regex": f"^{re.escape(item_name)}$", "$options": "i"}}
    res = await db.supply_requests.delete_many(q)
    return {"deleted": res.deleted_count}


async def _apply_mesh_op_to_order(op: dict) -> None:
    """Best-effort apply mesh op to MongoDB orders collection."""
    action = op.get("action")
    entity_id = op.get("entityId")
    payload = op.get("payload") or {}

    if action == "delete":
        try:
            await db.orders.delete_one({"_id": ObjectId(entity_id)})
        except Exception:
            await db.orders.delete_one({"client_id": entity_id})
        return

    if action == "id_remap":
        from_id = payload.get("fromId")
        to_id = payload.get("toId")
        if from_id and to_id:
            try:
                doc = await db.orders.find_one({"_id": ObjectId(from_id)})
            except Exception:
                doc = await db.orders.find_one({"client_id": from_id})
            if doc:
                await db.orders.delete_one({"_id": doc["_id"]})
        return

    order_doc = payload.get("order") or payload
    if not isinstance(order_doc, dict):
        return

    try:
        existing = await db.orders.find_one({"_id": ObjectId(entity_id)})
    except Exception:
        existing = await db.orders.find_one({"client_id": entity_id})

    if action == "item_status" and existing:
        line_id = payload.get("line_id")
        status = payload.get("status")
        if line_id and status in VALID_STATUSES:
            items = existing.get("items", [])
            for it in items:
                if it.get("line_id") == line_id:
                    it["status"] = status
            derived = _derive_order_status(items)
            await db.orders.update_one(
                {"_id": existing["_id"]},
                {"$set": {"items": items, "status": derived, "updated_at": _now().isoformat()}},
            )
        return

    if action == "payment" and existing:
        pay = payload.get("payment") or payload
        upd = {k: pay[k] for k in ("payment_status", "cash_amount", "upi_amount", "discount_amount", "discount_reason", "paid_at") if k in pay}
        if upd:
            upd["updated_at"] = _now().isoformat()
            await db.orders.update_one({"_id": existing["_id"]}, {"$set": upd})
        return

    if action in ("upsert", "create") and order_doc.get("guest_name"):
        if existing:
            await db.orders.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "guest_name": order_doc.get("guest_name", existing.get("guest_name")),
                    "guest_mobile": order_doc.get("guest_mobile", existing.get("guest_mobile")),
                    "notes": order_doc.get("notes", existing.get("notes", "")),
                    "items": order_doc.get("items", existing.get("items", [])),
                    "status": order_doc.get("status", existing.get("status")),
                    "updated_at": _now().isoformat(),
                }},
            )


@api_router.post("/sync/ops")
async def ingest_mesh_ops(payload: MeshOpsBatch, user=Depends(get_current_user)):
    accepted = []
    skipped = []
    for op in payload.ops:
        existing = await db.mesh_ops.find_one({"opId": op.opId})
        if existing:
            skipped.append(op.opId)
            continue
        doc = op.model_dump()
        doc["ingested_at"] = _now().isoformat()
        doc["ingested_by"] = str(user.get("_id", ""))
        await db.mesh_ops.insert_one(doc)
        try:
            await _apply_mesh_op_to_order(doc)
        except Exception as e:
            logger.warning(f"mesh op apply failed {op.opId}: {e}")
        accepted.append(op.opId)
    return {"accepted": accepted, "skipped": skipped}


@api_router.get("/sync/snapshot")
async def mesh_snapshot(
    since_lamport: int = 0,
    _user=Depends(get_current_user),
    limit: int = Query(500, le=2000),
):
    q = {"lamport": {"$gt": since_lamport}} if since_lamport else {}
    ops = await db.mesh_ops.find(q).sort("lamport", 1).to_list(limit)
    for o in ops:
        o.pop("_id", None)
    orders = await db.orders.find().sort("created_at", -1).to_list(200)
    return {
        "ops": ops,
        "orders": [_order_out(o) for o in orders],
        "since_lamport": since_lamport,
    }


# -------------------- Seed --------------------
DEFAULT_MENU = [
    # Breakfast
    {"name": "Aloo Paratha", "category": "Breakfast", "price": 120},
    {"name": "Paneer Paratha", "category": "Breakfast", "price": 150},
    {"name": "Plain Paratha", "category": "Breakfast", "price": 80},
    {"name": "Veg Omelette", "category": "Breakfast", "price": 110},
    {"name": "Bread Butter Jam", "category": "Breakfast", "price": 90},
    {"name": "Poha", "category": "Breakfast", "price": 80},
    {"name": "Maggi", "category": "Breakfast", "price": 90},
    # Beverages
    {"name": "Masala Chai", "category": "Beverages", "price": 40},
    {"name": "Black Tea", "category": "Beverages", "price": 30},
    {"name": "Filter Coffee", "category": "Beverages", "price": 60},
    {"name": "Hot Chocolate", "category": "Beverages", "price": 120},
    {"name": "Lemon Honey Ginger Tea", "category": "Beverages", "price": 70},
    # Chinese
    {"name": "Veg Momos (8 pcs)", "category": "Chinese", "price": 140},
    {"name": "Paneer Momos (8 pcs)", "category": "Chinese", "price": 180},
    {"name": "Veg Hakka Noodles", "category": "Chinese", "price": 160},
    {"name": "Veg Fried Rice", "category": "Chinese", "price": 160},
    {"name": "Veg Manchurian", "category": "Chinese", "price": 180},
    # Main Course
    {"name": "Dal Tadka", "category": "Main Course", "price": 160},
    {"name": "Steamed Rice", "category": "Main Course", "price": 90},
    {"name": "Jeera Rice", "category": "Main Course", "price": 110},
    {"name": "Paneer Butter Masala", "category": "Main Course", "price": 240},
    {"name": "Mixed Veg Curry", "category": "Main Course", "price": 180},
    {"name": "Roti (1 pc)", "category": "Main Course", "price": 20},
    # Snacks
    {"name": "Pakoras Plate", "category": "Snacks", "price": 130},
    {"name": "French Fries", "category": "Snacks", "price": 130},
]


async def _seed():
    # Indexes
    await db.users.create_index("mobile", unique=True)
    await db.menu_items.create_index([("category", 1), ("name", 1)])
    await db.orders.create_index([("created_at", -1)])
    await db.orders.create_index([("client_id", 1)], sparse=True)
    await db.orders.create_index([("guest_mobile", 1), ("payment_status", 1)])
    await db.mesh_ops.create_index("opId", unique=True)
    await db.mesh_ops.create_index([("lamport", 1)])
    await db.supply_requests.create_index([("created_at", -1)])

    admin_mobile = _normalize_mobile(os.environ.get("ADMIN_MOBILE", ""))
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_name = os.environ.get("ADMIN_NAME", "Admin")

    if admin_mobile and admin_password:
        existing = await db.users.find_one({"mobile": admin_mobile})
        if not existing:
            await db.users.insert_one({
                "mobile": admin_mobile,
                "name": admin_name,
                "password_hash": _hash_password(admin_password),
                "role": "admin",
                "created_at": _now().isoformat(),
            })
        else:
            # keep password in sync with env (idempotent)
            if not _verify_password(admin_password, existing.get("password_hash", "")):
                await db.users.update_one(
                    {"mobile": admin_mobile},
                    {"$set": {"password_hash": _hash_password(admin_password), "name": admin_name, "role": "admin"}},
                )

    # Staff session user (shared passcode login)
    staff_user = await db.users.find_one({"mobile": STAFF_SESSION_MOBILE})
    if not staff_user:
        await db.users.insert_one({
            "mobile": STAFF_SESSION_MOBILE,
            "name": STAFF_SESSION_NAME,
            "password_hash": _hash_password("unused"),
            "role": "staff",
            "created_at": _now().isoformat(),
        })

    # Shared staff passcode
    settings = await _get_settings()
    if not settings.get("staff_passcode_hash"):
        default_passcode = os.environ.get("STAFF_PASSCODE", "1234")
        if re.fullmatch(r"\d{4,6}", default_passcode or ""):
            await db.settings.update_one(
                {"_id": "app"},
                {"$set": {
                    "staff_passcode_hash": _hash_password(default_passcode),
                    "updated_at": _now().isoformat(),
                }},
                upsert=True,
            )
            logger.info("Seeded default staff passcode from STAFF_PASSCODE env (default 1234)")

    settings = await _get_settings()
    if not settings.get("mesh_pin"):
        default_mesh_pin = os.environ.get("MESH_PIN", "cafe1")
        if len(default_mesh_pin) >= 4:
            await db.settings.update_one(
                {"_id": "app"},
                {"$set": {"mesh_pin": default_mesh_pin, "mesh_pin_updated_at": _now().isoformat()}},
                upsert=True,
            )
            logger.info("Seeded default mesh PIN from MESH_PIN env")

    # Seed menu if empty
    count = await db.menu_items.count_documents({})
    if count == 0:
        docs = []
        now = _now().isoformat()
        for m in DEFAULT_MENU:
            docs.append({**m, "active": True, "created_at": now})
        if docs:
            await db.menu_items.insert_many(docs)


# -------------------- Routes mount + middleware --------------------
@api_router.get("/")
async def root():
    return {"app": "Chhaon Cafe Ops", "ok": True}


@api_router.get("/health")
async def health():
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_parse_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    try:
        await _seed()
        logger.info("Seed completed")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
