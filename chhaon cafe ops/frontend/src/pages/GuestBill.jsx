import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import api, { formatApiError } from "@/offline/api";
import { readCachedOrders } from "@/offline/sync";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  BedDouble,
  MapPin,
  Phone,
  IndianRupee,
  Banknote,
  Smartphone,
  Plus,
  Receipt,
  ChefHat,
  Bell,
  Check,
  Pencil,
} from "lucide-react";
import {
  groupOrdersByDate,
  formatOrderDay,
  formatGuestMobile,
  normalizeMobile,
  daysBetween,
  NEXT_ITEM,
  NEXT_ITEM_LABEL,
  itemStatusChip,
  isValidMobile,
} from "@/lib/orderUtils";

const NEXT_ICON = { new: ChefHat, preparing: Bell, ready: Check };

const orderKitchenSummary = (order) => {
  const items = order.items || [];
  const counts = { new: 0, preparing: 0, ready: 0, served: 0 };
  for (const it of items) {
    const s = it.status || "new";
    if (counts[s] !== undefined) counts[s] += 1;
  }
  return counts;
};

const inr = (n) => `₹${Number(n).toFixed(2)}`;

const GuestBill = () => {
  const { mobile } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [editingGuest, setEditingGuest] = useState(searchParams.get("edit") === "1");
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editWalkIn, setEditWalkIn] = useState(false);

  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [cashAmount, setCashAmount] = useState("0");
  const [upiAmount, setUpiAmount] = useState("0");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/guests/${mobile}/bill`, { params: { payment_status: "pending", days: 90 } });
      setBill(data);
      setDiscount("0");
      setDiscountReason("");
      setCashAmount(String(data.amount_due));
      setUpiAmount("0");
    } catch (e) {
      try {
        const norm = normalizeMobile(mobile);
        const cached = await readCachedOrders();
        const orders = cached.filter(
          (o) => normalizeMobile(o.guest_mobile) === norm && o.payment_status === "pending"
        );
        if (!orders.length) throw e;
        orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const subtotal = orders.reduce((a, o) => a + Number(o.subtotal ?? o.total ?? 0), 0);
        const discountTotal = orders.reduce((a, o) => a + Number(o.discount_amount || 0), 0);
        const amountDue = orders.reduce((a, o) => {
          const sub = Number(o.subtotal ?? o.total ?? 0);
          const disc = Number(o.discount_amount || 0);
          return a + Math.max(0, sub - disc);
        }, 0);
        const latest = orders[orders.length - 1];
        setBill({
          guest_mobile: norm,
          guest_name: latest.guest_name,
          room_number: latest.room_number,
          walk_in: latest.walk_in,
          orders,
          subtotal,
          discount_total: discountTotal,
          amount_due: amountDue,
          order_count: orders.length,
        });
        setCashAmount(String(amountDue));
      } catch {
        toast.error(formatApiError(e));
      }
    } finally {
      setLoading(false);
    }
  }, [mobile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!bill) return;
    setEditName(bill.guest_name || "");
    setEditMobile(bill.guest_mobile || "");
    setEditRoom(bill.room_number || "");
    setEditWalkIn(!!bill.walk_in);
  }, [bill]);

  useEffect(() => {
    if (searchParams.get("edit") === "1") setEditingGuest(true);
  }, [searchParams]);

  const byDate = useMemo(() => (bill ? groupOrdersByDate(bill.orders) : []), [bill]);
  const stayDays = bill?.orders?.length
    ? daysBetween(bill.orders[0].created_at, bill.orders[bill.orders.length - 1].created_at) + 1
    : 0;

  const discountNum = Math.max(0, Number(discount) || 0);
  const amountDue = Math.max(0, Math.round(((bill?.amount_due || 0) - discountNum) * 100) / 100);

  const replaceOrderInBill = (updated) => {
    setBill((prev) => {
      if (!prev) return prev;
      const orders = prev.orders.map((o) => (o.id === updated.id ? updated : o));
      const subtotal = orders.reduce((a, o) => a + Number(o.subtotal ?? o.total ?? 0), 0);
      const discountTotal = orders.reduce((a, o) => a + Number(o.discount_amount || 0), 0);
      const amountDueNext = orders.reduce((a, o) => {
        const sub = Number(o.subtotal ?? o.total ?? 0);
        const disc = Number(o.discount_amount || 0);
        return a + Math.max(0, sub - disc);
      }, 0);
      return { ...prev, orders, subtotal, discount_total: discountTotal, amount_due: amountDueNext };
    });
  };

  const advanceItem = async (order, item) => {
    const next = NEXT_ITEM[item.status || "new"];
    if (!next) return;
    const key = `${order.id}-${item.line_id}`;
    setBusyKey(key);
    try {
      const { data } = await api.patch(`/orders/${order.id}/items/${item.line_id}/status`, { status: next });
      replaceOrderInBill(data);
      toast.success(`${item.name} → ${NEXT_ITEM_LABEL[item.status || "new"] || next}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const saveGuestDetails = async () => {
    if (!bill) return;
    if (!editName.trim()) return toast.error("Guest name is required");
    if (!isValidMobile(editMobile)) return toast.error("Enter a valid 10-digit mobile");
    setBusy(true);
    try {
      const newMobile = normalizeMobile(editMobile);
      for (const order of bill.orders) {
        await api.patch(`/orders/${order.id}`, {
          guest_name: editName.trim(),
          guest_mobile: newMobile,
          walk_in: editWalkIn,
          room_number: editWalkIn ? "" : editRoom.trim(),
        });
      }
      toast.success("Guest details updated");
      setEditingGuest(false);
      setSearchParams({});
      if (newMobile !== normalizeMobile(mobile)) {
        navigate(`/guests/${newMobile}`, { replace: true });
      } else {
        await load();
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const settle = async () => {
    if (!bill) return;
    if (discountNum > bill.amount_due) return toast.error("Discount cannot exceed tab total");
    const cash = paymentStatus === "paid" ? Math.max(0, Number(cashAmount) || 0) : 0;
    const upi = paymentStatus === "paid" ? Math.max(0, Number(upiAmount) || 0) : 0;
    if (paymentStatus === "paid" && Math.abs(cash + upi - amountDue) > 0.01) {
      return toast.error(`Cash + UPI must equal ₹${amountDue.toFixed(2)}`);
    }
    setBusy(true);
    try {
      await api.post(`/guests/${mobile}/settle`, {
        discount_amount: discountNum,
        discount_reason: discountReason,
        payment_status: paymentStatus,
        cash_amount: cash,
        upi_amount: upi,
      });
      toast.success(paymentStatus === "paid" ? "Guest tab settled" : "Bill updated");
      navigate("/orders");
    } catch (e) {
      const offline = typeof navigator !== "undefined" && (!navigator.onLine || !e?.response);
      if (!offline) {
        toast.error(formatApiError(e));
        return;
      }
      try {
        const orders = bill.orders.filter((o) => o.payment_status === "pending");
        const totalBase = orders.reduce((a, o) => a + Number(o.subtotal ?? o.total ?? 0), 0);
        let remainingDisc = discountNum;
        let remainingCash = cash;
        let remainingUpi = upi;
        for (let i = 0; i < orders.length; i++) {
          const o = orders[i];
          const share = totalBase ? Number(o.subtotal ?? o.total ?? 0) / totalBase : 0;
          const oDisc = i < orders.length - 1 ? Math.round(discountNum * share * 100) / 100 : remainingDisc;
          remainingDisc = Math.round((remainingDisc - oDisc) * 100) / 100;
          const oDue = Math.max(0, Number(o.subtotal ?? o.total ?? 0) - oDisc);
          const oCash = paymentStatus === "paid" && i < orders.length - 1 ? Math.round(cash * (oDue / amountDue) * 100) / 100 : remainingCash;
          const oUpi = paymentStatus === "paid" && i < orders.length - 1 ? Math.round(upi * (oDue / amountDue) * 100) / 100 : remainingUpi;
          if (paymentStatus === "paid" && i < orders.length - 1) {
            remainingCash = Math.round((remainingCash - oCash) * 100) / 100;
            remainingUpi = Math.round((remainingUpi - oUpi) * 100) / 100;
          }
          await api.patch(`/orders/${o.id}/payment`, {
            discount_amount: oDisc,
            discount_reason: discountReason,
            payment_status: paymentStatus,
            cash_amount: paymentStatus === "paid" ? oCash : 0,
            upi_amount: paymentStatus === "paid" ? oUpi : 0,
          });
        }
        toast.success("Tab settlement saved offline");
        navigate("/orders");
      } catch (err) {
        toast.error(formatApiError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const fillAllCash = () => {
    setCashAmount(String(amountDue));
    setUpiAmount("0");
  };

  const fillAllUpi = () => {
    setUpiAmount(String(amountDue));
    setCashAmount("0");
  };

  if (loading) {
    return <div className="font-display text-3xl text-sage animate-pulse">loading guest bill…</div>;
  }
  if (!bill) {
    return (
      <div className="text-center py-12">
        <p className="text-ink2">No open tab for this guest.</p>
        <button onClick={() => navigate("/orders")} className="mt-4 text-sage-dark font-semibold">Back to guest board</button>
      </div>
    );
  }

  const newOrderParams = new URLSearchParams({
    name: bill.guest_name,
    mobile: bill.guest_mobile,
  });
  if (bill.room_number) newOrderParams.set("room", bill.room_number);
  if (bill.walk_in) newOrderParams.set("walk_in", "1");

  return (
    <div className="animate-fade-up max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="dense-toolbar mb-2 sm:mb-4 print:hidden">
        <button onClick={() => navigate("/orders")} className="inline-flex items-center gap-1.5 text-ink2 hover:text-ink font-semibold text-sm" data-testid="back-button">
          <ArrowLeft className="w-4 h-4" /> Guests
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setEditingGuest((v) => !v)}
          className="btn-icon"
          title="Edit guest"
          data-testid="toggle-guest-edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <Link
          to={`/orders/new?${newOrderParams.toString()}`}
          className="btn-icon"
          title="Add order"
        >
          <Plus className="w-3.5 h-3.5" />
        </Link>
        <button onClick={() => window.print()} className="btn-icon" data-testid="print-bill-button" title="Print">
          <Printer className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="card p-3 sm:p-6 print:shadow-none print:border-0 min-w-0" data-testid="guest-bill-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-ink2/80">Guest statement</div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink leading-none mt-0.5 break-words" data-testid="guest-bill-title">
              {bill.guest_name}
            </h1>
            <p className="text-xs text-ink2 mt-1">
              {bill.order_count} order{bill.order_count !== 1 ? "s" : ""}
              {stayDays > 1 ? ` · ${stayDays} days` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-3xl sm:text-4xl text-ink leading-none" data-testid="guest-amount-due">₹{amountDue.toFixed(0)}</div>
            <div className="text-[10px] text-ink2 uppercase font-semibold">due</div>
          </div>
        </div>

        {editingGuest ? (
          <div className="mt-3 rounded-xl border border-sage/30 bg-[#F2F7F1]/50 p-3 space-y-2 print:hidden" data-testid="guest-edit-panel">
            <div className="text-xs font-semibold text-ink uppercase tracking-wide">Edit guest (all open orders)</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-ink2">Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input mt-0.5" data-testid="guest-edit-name" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-ink2">Mobile</label>
                <input
                  inputMode="numeric"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="input mt-0.5"
                  data-testid="guest-edit-mobile"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-ink2">Room</label>
                <input
                  value={editRoom}
                  onChange={(e) => setEditRoom(e.target.value)}
                  disabled={editWalkIn}
                  className="input mt-0.5 disabled:opacity-50"
                  data-testid="guest-edit-room"
                />
              </div>
              <label className="flex items-end gap-2 pb-1 text-sm font-semibold text-ink cursor-pointer">
                <input type="checkbox" checked={editWalkIn} onChange={(e) => setEditWalkIn(e.target.checked)} data-testid="guest-edit-walkin" />
                Walk-in
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveGuestDetails} disabled={busy} className="btn-primary flex-1" data-testid="guest-edit-save">
                Save guest
              </button>
              <button
                type="button"
                onClick={() => { setEditingGuest(false); setSearchParams({}); }}
                className="btn-secondary px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink2">
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Phone className="w-3 h-3" /> {formatGuestMobile(bill.guest_mobile)}
            </span>
            <span className="inline-flex items-center gap-1">
              {bill.walk_in ? <><MapPin className="w-3 h-3" /> Walk-in</> : <><BedDouble className="w-3 h-3" /> Room {bill.room_number || "—"}</>}
            </span>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {byDate.map(([day, dayOrders]) => (
            <section key={day} data-testid={`bill-day-${day}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-oat/50 pb-1">
                <h2 className="font-display text-lg sm:text-xl text-ink">{formatOrderDay(dayOrders[0].created_at)}</h2>
                <span className="text-xs text-ink2 font-semibold">
                  {inr(dayOrders.reduce((a, o) => a + Number(o.subtotal ?? o.total ?? 0), 0))}
                </span>
              </div>
              {dayOrders.map((order) => {
                const summary = orderKitchenSummary(order);
                const activeItems = summary.new + summary.preparing + summary.ready;
                return (
                <div key={order.id} className="mb-3 last:mb-0" data-testid={`bill-order-${order.id}`}>
                  <div className="flex items-center justify-between gap-1 text-[11px] mb-1 print:hidden">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="font-semibold text-ink">#{order.order_no}</span>
                      <span className="text-ink2">
                        {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {activeItems > 0 ? (
                        <span className="chip bg-[#FEF5EC] text-[#E6A15C]">{activeItems} kitchen</span>
                      ) : (order.items || []).length > 0 ? (
                        <span className="chip bg-[#F2F7F1] text-[#7B9E73]">served</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link to={`/orders/${order.id}/edit`} className="btn-icon w-7 h-7" title="Edit order" data-testid={`edit-order-${order.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Link>
                      <Link to={`/orders/${order.id}`} className="btn-icon w-7 h-7" title="Order details">
                        <Receipt className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-oat/40 rounded-lg border border-oat/40 overflow-hidden">
                    {(order.items || []).map((it, idx) => {
                      const chip = itemStatusChip(it.status || "new");
                      const next = NEXT_ITEM[it.status || "new"];
                      const NextIcon = next ? NEXT_ICON[it.status || "new"] : null;
                      const lineKey = `${order.id}-${it.line_id || idx}`;
                      return (
                      <div key={it.line_id || idx} className="line-item-row" data-testid={`bill-line-${lineKey}`}>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-ink text-xs sm:text-sm leading-tight">{it.quantity}× {it.name}</div>
                        </div>
                        <span className={`chip shrink-0 ${chip.chip}`}>{chip.label}</span>
                        <div className="text-xs font-semibold text-ink shrink-0 w-12 text-right">{inr(it.line_total)}</div>
                        {next && NextIcon && (
                          <button
                            type="button"
                            disabled={busyKey === lineKey}
                            onClick={() => advanceItem(order, it)}
                            data-testid={`advance-item-${lineKey}`}
                            title={NEXT_ITEM_LABEL[it.status || "new"]}
                            className="print:hidden inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sage text-white btn-tactile hover:bg-sage-dark disabled:opacity-60 shrink-0"
                          >
                            <NextIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );})}
                  </div>
                  {order.notes ? (
                    <p className="text-xs italic text-tan-dark mt-1.5">“{order.notes}”</p>
                  ) : null}
                </div>
              );})}
            </section>
          ))}
        </div>

        <div className="mt-4 border-t border-oat/70 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-ink2">Subtotal ({bill.order_count})</span>
            <span className="font-semibold">{inr(bill.subtotal)}</span>
          </div>
          {bill.discount_total > 0 && (
            <div className="flex justify-between">
              <span className="text-ink2">Order discounts</span>
              <span className="font-semibold text-statusNew">−{inr(bill.discount_total)}</span>
            </div>
          )}
          {discountNum > 0 && (
            <div className="flex justify-between">
              <span className="text-ink2">Checkout discount</span>
              <span className="font-semibold text-statusNew">−{inr(discountNum)}</span>
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-oat/70 pt-3 print:hidden" id="guest-settle-section" data-testid="guest-settle-section">
          <div className="text-[10px] uppercase tracking-wide text-ink2/80 font-semibold mb-2 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Settle tab
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-ink2/80">Discount (₹)</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                data-testid="guest-discount-input"
                className="input mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink2/80">Reason</label>
              <input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="optional"
                data-testid="guest-discount-reason-input"
                className="input mt-0.5"
              />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {["pending", "paid"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPaymentStatus(s)}
                data-testid={`guest-payment-status-${s}`}
                className={`h-9 rounded-xl border font-semibold text-sm btn-tactile capitalize ${paymentStatus === s ? (s === "paid" ? "bg-sage text-white border-sage" : "bg-tan text-white border-tan") : "bg-white border-oat text-ink2"}`}
              >
                {s}
              </button>
            ))}
          </div>

          {paymentStatus === "paid" && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-ink2/80 inline-flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash</label>
                  <input type="number" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} data-testid="guest-cash-input" className="input mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink2/80 inline-flex items-center gap-1"><Smartphone className="w-3 h-3" /> UPI</label>
                  <input type="number" min="0" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} data-testid="guest-upi-input" className="input mt-0.5" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={fillAllCash} className="text-[11px] font-semibold text-sage-dark px-2 py-1 rounded-lg bg-cream border border-oat btn-tactile">All cash</button>
                <button type="button" onClick={fillAllUpi} className="text-[11px] font-semibold text-sage-dark px-2 py-1 rounded-lg bg-cream border border-oat btn-tactile">All UPI</button>
              </div>
            </div>
          )}

          <button
            onClick={settle}
            disabled={busy}
            data-testid="settle-guest-button"
            className="mt-3 w-full h-10 rounded-xl bg-sage text-white font-semibold inline-flex items-center justify-center gap-2 btn-tactile disabled:opacity-60"
          >
            <IndianRupee className="w-4 h-4" />
            {busy ? "Settling…" : paymentStatus === "paid" ? `Settle · ₹${amountDue.toFixed(0)}` : "Update tab"}
          </button>
        </div>
      </div>

      {/* Mobile sticky settle shortcut */}
      <div className="md:hidden fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 bg-bone/95 backdrop-blur border-t border-oat px-3 py-2 flex items-center gap-2 print:hidden">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-ink2 uppercase font-semibold">Due</div>
          <div className="font-display text-2xl text-ink leading-none">₹{amountDue.toFixed(0)}</div>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById("guest-settle-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="btn-secondary h-9 px-3 text-xs"
        >
          Payment
        </button>
        <button
          onClick={settle}
          disabled={busy}
          className="btn-primary h-9 px-4"
        >
          {busy ? "…" : "Settle"}
        </button>
      </div>
    </div>
  );
};

export default GuestBill;
