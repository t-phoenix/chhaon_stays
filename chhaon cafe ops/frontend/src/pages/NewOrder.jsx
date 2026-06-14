import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiError } from "@/offline/api";
import { makeLocalId } from "@/offline/db";
import { toast } from "sonner";
import { X } from "lucide-react";
import { normalizeMobile, isValidMobile } from "@/lib/orderUtils";
import GuestFields from "@/components/order/GuestFields";
import MenuSection from "@/components/order/MenuSection";
import CartPanel from "@/components/order/CartPanel";
import MobileCartBar from "@/components/order/MobileCartBar";

const NewOrder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [menu, setMenu] = useState([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [guestName, setGuestName] = useState(searchParams.get("name") || "");
  const [guestMobile, setGuestMobile] = useState(normalizeMobile(searchParams.get("mobile") || ""));
  const [roomNumber, setRoomNumber] = useState(searchParams.get("room") || "");
  const [walkIn, setWalkIn] = useState(searchParams.get("walk_in") === "1");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState({});
  const [miscItems, setMiscItems] = useState([]);
  const [miscName, setMiscName] = useState("");
  const [miscPrice, setMiscPrice] = useState("");
  const [openTab, setOpenTab] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const loadMenu = useCallback(async () => {
    try {
      const { data } = await api.get("/menu", { params: { active_only: true } });
      setMenu(Array.isArray(data) ? data : []);
    } catch (e) {
      const { getAllMenu } = await import("@/offline/db");
      const cached = await getAllMenu();
      const active = cached.filter((m) => m.active !== false);
      if (active.length) {
        setMenu(active);
        return;
      }
      toast.error(formatApiError(e));
    }
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  useEffect(() => {
    const mobile = normalizeMobile(guestMobile);
    if (!isValidMobile(mobile)) {
      setOpenTab(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/guests/${mobile}/bill`, { params: { payment_status: "pending", days: 90 } });
        setOpenTab(data);
        setGuestName((prev) => prev.trim() || data.guest_name || "");
        setRoomNumber((prev) => prev || data.room_number || "");
        setWalkIn((prev) => prev || Boolean(data.walk_in));
      } catch {
        setOpenTab(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [guestMobile]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map((m) => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(
    (m) => (cat === "All" || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase())
  ), [menu, cat, q]);

  const setQty = (id, delta) => {
    setCart((prev) => {
      const cur = prev[id] || 0;
      const next = Math.max(0, cur + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id]; else copy[id] = next;
      return copy;
    });
  };

  const setQtyExact = (id, val) => {
    setCart((prev) => {
      const next = Math.max(0, Math.min(99, parseInt(val || "0", 10) || 0));
      const copy = { ...prev };
      if (next === 0) delete copy[id]; else copy[id] = next;
      return copy;
    });
  };

  const cartLines = useMemo(() => {
    const menuLines = Object.entries(cart).map(([id, qty]) => {
      const m = menu.find((x) => x.id === id);
      return m ? { ...m, qty, line: m.price * qty, isMisc: false } : null;
    }).filter(Boolean);
    const miscLines = miscItems.map((m) => ({
      id: m.id,
      name: m.name,
      category: "Miscellaneous",
      price: m.price,
      qty: m.qty,
      line: m.price * m.qty,
      isMisc: true,
    }));
    return [...menuLines, ...miscLines];
  }, [cart, menu, miscItems]);

  const total = cartLines.reduce((a, b) => a + b.line, 0);
  const totalCount = cartLines.reduce((a, b) => a + b.qty, 0);

  const addMisc = () => {
    const name = miscName.trim();
    const price = Number(miscPrice);
    if (!name) return toast.error("Add a name for the misc item");
    if (!price || price < 0) return toast.error("Add a valid price");
    setMiscItems((prev) => [...prev, { id: `misc_${Date.now()}`, name, price, qty: 1 }]);
    setMiscName("");
    setMiscPrice("");
  };

  const buildItemsPayload = () => cartLines.map((l) => {
    if (l.isMisc) {
      return { custom_name: l.name, custom_price: l.price, quantity: l.qty };
    }
    return { menu_item_id: l.id, quantity: l.qty };
  });

  const submit = async () => {
    if (!guestName.trim()) return toast.error("Guest name is required");
    if (!isValidMobile(guestMobile)) return toast.error("Valid 10-digit mobile is required");
    if (cartLines.length === 0) return toast.error("Add at least one item");
    setBusy(true);
    try {
      const items = buildItemsPayload();
      const clientId = makeLocalId();
      const payload = {
        client_id: clientId,
        guest_name: guestName.trim(),
        guest_mobile: normalizeMobile(guestMobile),
        walk_in: walkIn,
        room_number: walkIn ? null : (roomNumber.trim() || null),
        notes: notes.trim(),
        items,
      };
      const { data } = await api.post("/orders", payload);
      toast.success(data._offline ? "Order saved offline" : `Order #${data.order_no} added to ${guestName}'s tab`);
      if (openTab) navigate(`/guests/${normalizeMobile(guestMobile)}`);
      else navigate(`/orders/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const cartHandlers = {
    onRemove: (id, isMisc) => {
      if (isMisc) setMiscItems((prev) => prev.filter((x) => x.id !== id));
      else setQtyExact(id, 0);
    },
    onChangeQty: (id, val, isMisc) => {
      if (isMisc) {
        setMiscItems((prev) => prev.map((x) => (x.id === id ? { ...x, qty: Math.max(1, parseInt(val || "1", 10) || 1) } : x)));
      } else setQtyExact(id, val);
    },
  };

  return (
    <div className="animate-fade-up order-page">
      <div className="page-header">
        <div className="min-w-0">
          <div className="page-eyebrow">new order</div>
          <h1 className="page-title">add items</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-3 lg:gap-4">
        <div className="space-y-3 min-w-0">
          <GuestFields
            guestName={guestName}
            setGuestName={setGuestName}
            guestMobile={guestMobile}
            setGuestMobile={setGuestMobile}
            roomNumber={roomNumber}
            setRoomNumber={setRoomNumber}
            walkIn={walkIn}
            setWalkIn={setWalkIn}
            openTab={openTab}
          />

          <MenuSection
            categories={categories}
            cat={cat}
            setCat={setCat}
            q={q}
            setQ={setQ}
            filtered={filtered}
            cart={cart}
            setQty={setQty}
            miscName={miscName}
            setMiscName={setMiscName}
            miscPrice={miscPrice}
            setMiscPrice={setMiscPrice}
            onAddMisc={addMisc}
          />
        </div>

        <CartPanel
          cartLines={cartLines}
          total={total}
          notes={notes}
          setNotes={setNotes}
          onRemove={cartHandlers.onRemove}
          onChangeQty={cartHandlers.onChangeQty}
          onSubmit={submit}
          busy={busy}
          className="hidden lg:block sticky top-20"
        />
      </div>

      <MobileCartBar
        total={total}
        totalCount={totalCount}
        onOpenCart={() => setCartOpen(true)}
        onSubmit={submit}
        busy={busy}
        canSubmit={cartLines.length > 0 && !!guestName.trim() && isValidMobile(guestMobile)}
        submitLabel="Send"
      />

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setCartOpen(false)} aria-hidden />
          <div className="absolute bottom-0 left-0 right-0 bg-bone rounded-t-2xl p-3 max-h-[min(85vh,100dvh)] overflow-y-auto animate-fade-up safe-bottom">
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-2xl text-ink leading-none">Cart</div>
              <button type="button" onClick={() => setCartOpen(false)} className="btn-icon" data-testid="close-cart-mobile">
                <X className="w-4 h-4" />
              </button>
            </div>
            <CartPanel
              cartLines={cartLines}
              total={total}
              notes={notes}
              setNotes={setNotes}
              onRemove={cartHandlers.onRemove}
              onChangeQty={cartHandlers.onChangeQty}
              onSubmit={async () => { await submit(); setCartOpen(false); }}
              busy={busy}
              embedded
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NewOrder;
