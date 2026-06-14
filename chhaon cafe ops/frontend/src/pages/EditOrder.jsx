import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api, { formatApiError } from "@/offline/api";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, X } from "lucide-react";
import { normalizeMobile, isValidMobile } from "@/lib/orderUtils";
import GuestFields from "@/components/order/GuestFields";
import MenuSection from "@/components/order/MenuSection";
import CartPanel from "@/components/order/CartPanel";
import MobileCartBar from "@/components/order/MobileCartBar";

const EditOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [walkIn, setWalkIn] = useState(false);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState({});
  const [lineIds, setLineIds] = useState({});
  const [miscItems, setMiscItems] = useState([]);
  const [miscName, setMiscName] = useState("");
  const [miscPrice, setMiscPrice] = useState("");
  const [orderNo, setOrderNo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);

  const loadMenu = useCallback(async () => {
    const { data } = await api.get("/menu", { params: { active_only: true } });
    setMenu(data);
  }, []);

  const loadOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrderNo(data.order_no);
      setGuestName(data.guest_name);
      setGuestMobile(data.guest_mobile || "");
      setRoomNumber(data.room_number || "");
      setWalkIn(data.walk_in);
      setNotes(data.notes || "");
      const initial = {};
      const ids = {};
      const misc = [];
      for (const it of data.items) {
        if (it.is_misc) {
          misc.push({ lineId: it.line_id, id: it.line_id, name: it.name, price: it.price, qty: it.quantity });
        } else {
          initial[it.menu_item_id] = it.quantity;
          ids[it.menu_item_id] = it.line_id;
        }
      }
      setCart(initial);
      setLineIds(ids);
      setMiscItems(misc);
    } catch (e) {
      toast.error(formatApiError(e));
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    Promise.all([loadMenu(), loadOrder()]).catch((e) => toast.error(formatApiError(e)));
  }, [loadMenu, loadOrder]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map((m) => m.category)))], [menu]);
  const filtered = useMemo(() => menu.filter(
    (m) => (cat === "All" || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase())
  ), [menu, cat, q]);

  const setQty = (itemId, delta) => {
    setCart((prev) => {
      const cur = prev[itemId] || 0;
      const next = Math.max(0, cur + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[itemId]; else copy[itemId] = next;
      return copy;
    });
  };

  const setQtyExact = (itemId, val) => {
    setCart((prev) => {
      const next = Math.max(0, Math.min(99, parseInt(val || "0", 10) || 0));
      const copy = { ...prev };
      if (next === 0) delete copy[itemId]; else copy[itemId] = next;
      return copy;
    });
  };

  const cartLines = useMemo(() => {
    const menuLines = Object.entries(cart).map(([itemId, qty]) => {
      const m = menu.find((x) => x.id === itemId);
      if (m) return { ...m, qty, line: m.price * qty, lineId: lineIds[itemId], isMisc: false };
      return { id: itemId, lineId: lineIds[itemId], name: "Item (menu updated)", category: "—", price: 0, qty, line: 0, isMisc: false };
    });
    const miscLines = miscItems.map((m) => ({
      id: m.id,
      lineId: m.lineId,
      name: m.name,
      category: "Miscellaneous",
      price: m.price,
      qty: m.qty,
      line: m.price * m.qty,
      isMisc: true,
    }));
    return [...menuLines, ...miscLines];
  }, [cart, menu, lineIds, miscItems]);

  const total = cartLines.reduce((a, b) => a + b.line, 0);
  const totalCount = cartLines.reduce((a, b) => a + b.qty, 0);

  const save = async () => {
    if (!guestName.trim()) return toast.error("Guest name is required");
    if (!isValidMobile(guestMobile)) return toast.error("Valid 10-digit mobile is required");
    if (cartLines.length === 0) return toast.error("Add at least one item");
    setBusy(true);
    try {
      const payload = {
        guest_name: guestName.trim(),
        guest_mobile: normalizeMobile(guestMobile),
        walk_in: walkIn,
        room_number: walkIn ? null : (roomNumber.trim() || null),
        notes: notes.trim(),
        items: cartLines.map((l) => {
          if (l.isMisc) {
            return { line_id: l.lineId, custom_name: l.name, custom_price: l.price, quantity: l.qty };
          }
          return { line_id: l.lineId, menu_item_id: l.id, quantity: l.qty };
        }),
      };
      const { data } = await api.patch(`/orders/${id}`, payload);
      toast.success(`Order #${data.order_no} updated`);
      navigate(`/orders/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.delete(`/orders/${id}`);
      toast.success("Order deleted");
      navigate("/orders");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const addMisc = () => {
    const name = miscName.trim();
    const price = Number(miscPrice);
    if (!name || !price) return toast.error("Name and price required");
    const lineId = `misc_${Date.now()}`;
    setMiscItems((prev) => [...prev, { lineId, id: lineId, name, price, qty: 1 }]);
    setMiscName("");
    setMiscPrice("");
  };

  const cartHandlers = {
    onRemove: (itemId, isMisc) => {
      if (isMisc) setMiscItems((prev) => prev.filter((x) => x.id !== itemId));
      else setQtyExact(itemId, 0);
    },
    onChangeQty: (itemId, val, isMisc) => {
      if (isMisc) {
        setMiscItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, qty: Math.max(1, parseInt(val || "1", 10) || 1) } : x)));
      } else setQtyExact(itemId, val);
    },
  };

  if (loading) {
    return <div className="text-sm text-sage animate-pulse">Loading order…</div>;
  }

  return (
    <div className="animate-fade-up order-page">
      <div className="dense-toolbar mb-2 sm:mb-3">
        <Link to={`/orders/${id}`} className="inline-flex items-center gap-1.5 text-ink2 hover:text-ink font-semibold text-sm" data-testid="edit-back-link">
          <ArrowLeft className="w-4 h-4 shrink-0" /> Order #{orderNo}
        </Link>
        <div className="flex-1" />
        <button type="button" onClick={remove} disabled={busy} data-testid="edit-delete-order-button" className="btn-icon text-statusNew border-statusNew/30" title="Delete order">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
            nameTestId="edit-guest-name-input"
            mobileTestId="edit-guest-mobile-input"
            roomTestId="edit-room-number-input"
            walkInTestId="edit-walk-in-toggle"
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
            searchTestId="edit-menu-search-input"
            testPrefix="edit-"
          />
        </div>

        <CartPanel
          cartLines={cartLines}
          total={total}
          notes={notes}
          setNotes={setNotes}
          onRemove={cartHandlers.onRemove}
          onChangeQty={cartHandlers.onChangeQty}
          onSubmit={save}
          busy={busy}
          testId="edit-cart-panel"
          submitLabel="Save changes"
          submitIcon={Save}
          busyLabel="Saving…"
          totalLabel="New subtotal"
          notesTestId="edit-order-notes-input"
          submitTestId="save-order-button"
          className="hidden lg:block sticky top-20"
        />
      </div>

      <MobileCartBar
        total={total}
        totalCount={totalCount}
        onOpenCart={() => setCartOpen(true)}
        onSubmit={save}
        busy={busy}
        canSubmit={cartLines.length > 0 && !!guestName.trim() && isValidMobile(guestMobile)}
        submitLabel="Save"
        submitIcon={Save}
      />

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setCartOpen(false)} aria-hidden />
          <div className="absolute bottom-0 left-0 right-0 bg-bone rounded-t-2xl p-3 max-h-[min(85vh,100dvh)] overflow-y-auto animate-fade-up safe-bottom">
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-2xl text-ink leading-none">Edit cart</div>
              <button type="button" onClick={() => setCartOpen(false)} className="btn-icon">
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
              onSubmit={async () => { await save(); setCartOpen(false); }}
              busy={busy}
              embedded
              submitLabel="Save changes"
              submitIcon={Save}
              busyLabel="Saving…"
              totalLabel="New subtotal"
              notesTestId="edit-order-notes-input"
              submitTestId="save-order-button"
            />
            <p className="text-[11px] text-ink2 mt-2">Paid bills reset to pending if items change.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditOrder;
