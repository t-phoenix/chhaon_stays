import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { formatApiError } from "@/offline/api";
import { onSyncChange } from "@/offline/sync";
import { toast } from "sonner";
import { ArrowLeft, Printer, BedDouble, MapPin, IndianRupee, Banknote, Smartphone, Pencil, Trash2, Phone } from "lucide-react";
import { NEXT_ITEM, itemStatusChip, formatGuestMobile, normalizeMobile, isValidMobile, mergeOrderWithLocal } from "@/lib/orderUtils";

const inr = (n) => `₹${Number(n).toFixed(2)}`;

const STATUS_CHIP = {
  new: { chip: "bg-[#FDF0F0] text-[#D96C6C]", dot: "bg-[#D96C6C]", label: "New" },
  preparing: { chip: "bg-[#FEF5EC] text-[#E6A15C]", dot: "bg-[#E6A15C]", label: "Preparing" },
  ready: { chip: "bg-[#F2F7F1] text-[#7B9E73]", dot: "bg-[#7B9E73]", label: "Ready" },
  served: { chip: "bg-[#F5F6F5] text-[#A3A8A1]", dot: "bg-[#A3A8A1]", label: "Served" },
};
const PAYMENT_CHIP = {
  pending: { chip: "bg-[#FEF5EC] text-[#E6A15C]", label: "Pending" },
  paid: { chip: "bg-[#F2F7F1] text-[#7B9E73]", label: "Paid" },
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [cashAmount, setCashAmount] = useState("0");
  const [upiAmount, setUpiAmount] = useState("0");

  const syncPaymentForm = useCallback((o) => {
    setDiscount(String(o.discount_amount || 0));
    setDiscountReason(o.discount_reason || "");
    setPaymentStatus(o.payment_status || "pending");
    setCashAmount(String(o.cash_amount || 0));
    setUpiAmount(String(o.upi_amount || 0));
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
      syncPaymentForm(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [id, syncPaymentForm]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = onSyncChange(() => { load(); });
    return unsub;
  }, [load]);

  const subtotal = order ? Number(order.subtotal ?? order.total) : 0;
  const discountNum = Math.max(0, Number(discount) || 0);
  const amountDue = Math.max(0, Math.round((subtotal - discountNum) * 100) / 100);

  const advanceItem = async (lineId, status) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${id}/items/${lineId}/status`, { status });
      const nextOrder = data ? { ...data, items: (data.items || []).map((it) => ({ ...it })) } : data;
      setOrder((prev) => (prev && nextOrder ? mergeOrderWithLocal(nextOrder, prev) : nextOrder));
      toast.success(`Marked ${status}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async () => {
    if (discountNum > subtotal) {
      return toast.error("Discount cannot exceed subtotal");
    }
    const cash = paymentStatus === "paid" ? Math.max(0, Number(cashAmount) || 0) : 0;
    const upi = paymentStatus === "paid" ? Math.max(0, Number(upiAmount) || 0) : 0;
    if (paymentStatus === "paid" && Math.abs(cash + upi - amountDue) > 0.01) {
      return toast.error(`Cash + UPI must equal ₹${amountDue.toFixed(2)}`);
    }
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${id}/payment`, {
        discount_amount: discountNum,
        discount_reason: discountReason,
        payment_status: paymentStatus,
        cash_amount: cash,
        upi_amount: upi,
      });
      setOrder(data);
      syncPaymentForm(data);
      toast.success(paymentStatus === "paid" ? "Payment recorded" : "Bill updated");
    } catch (e) {
      toast.error(formatApiError(e));
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

  if (loading) {
    return <div className="font-display text-3xl text-sage animate-pulse">loading order…</div>;
  }
  if (!order) return <div>Order not found</div>;

  const chip = STATUS_CHIP[order.status];
  const payChip = PAYMENT_CHIP[order.payment_status] || PAYMENT_CHIP.pending;

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <div className="dense-toolbar mb-2 sm:mb-4 print:hidden">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-ink2 hover:text-ink font-semibold text-sm" data-testid="back-button">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1" />
        <Link to={`/orders/${id}/edit`} className="btn-icon" title="Edit order" data-testid="edit-order-button">
          <Pencil className="w-3.5 h-3.5" />
        </Link>
        <button onClick={() => window.print()} className="btn-icon" data-testid="print-bill-button" title="Print">
          <Printer className="w-3.5 h-3.5" />
        </button>
        <button data-testid="delete-order-button" onClick={remove} disabled={busy} className="btn-icon text-statusNew border-statusNew/30" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bill card */}
      <div className="card p-3 sm:p-6 print:shadow-none print:border-0 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-ink2/80">Order</div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink leading-none mt-0.5 break-words" data-testid="order-title">#{order.order_no}</h1>
            <p className="text-sm font-semibold text-ink mt-1">{order.guest_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span data-testid="order-status-chip" className={`chip ${chip.chip}`}>
              {chip.label}
            </span>
            <span data-testid="payment-status-chip" className={`chip ${payChip.chip}`}>
              {payChip.label}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink2">
          {order.guest_mobile && (
            <span className="inline-flex items-center gap-1 font-semibold text-ink" data-testid="order-guest-name">
              <Phone className="w-3 h-3" /> {formatGuestMobile(order.guest_mobile)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            {order.walk_in ? <><MapPin className="w-3 h-3" /> Walk-in</> : <><BedDouble className="w-3 h-3" /> Room {order.room_number || "—"}</>}
          </span>
          <span>{new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
          {order.guest_mobile && isValidMobile(order.guest_mobile) && order.payment_status === "pending" && (
            <Link to={`/guests/${normalizeMobile(order.guest_mobile)}`} className="font-semibold text-sage-dark print:hidden" data-testid="view-guest-tab-link">
              Guest tab →
            </Link>
          )}
        </div>

        <div className="mt-4 border-t border-oat/70 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-ink2/80 font-semibold mb-1.5">Items</div>
          <div className="divide-y divide-oat/60 rounded-lg border border-oat/40 overflow-hidden">
            {order.items.map((it, idx) => {
              const itemChip = itemStatusChip(it.status || "new");
              const nextItem = NEXT_ITEM[it.status || "new"];
              return (
              <div key={`${order.id}-${it.line_id || idx}`} data-testid={`bill-line-${idx}`} className="line-item-row">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink text-xs sm:text-sm">{it.quantity}× {it.name}</div>
                </div>
                <span className={`chip shrink-0 ${itemChip.chip}`}>{itemChip.label}</span>
                <div className="text-xs font-semibold text-ink shrink-0 w-12 text-right">{inr(it.line_total)}</div>
                {nextItem && (
                  <button
                    disabled={busy}
                    onClick={() => advanceItem(it.line_id, nextItem)}
                    data-testid={`advance-item-${it.line_id}`}
                    className="print:hidden inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sage text-white text-[10px] font-semibold btn-tactile disabled:opacity-60 shrink-0"
                  >
                    →
                  </button>
                )}
              </div>
            );})}
          </div>
        </div>

        {order.notes ? (
          <div className="mt-5 italic text-tan-dark bg-tan-light/15 border border-tan-light/40 px-4 py-3 rounded-xl">
            “{order.notes}”
          </div>
        ) : null}

        {/* Totals */}
        <div className="mt-4 border-t border-oat/70 pt-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="text-ink2">Subtotal</div>
            <div className="font-semibold text-ink">{inr(subtotal)}</div>
          </div>
          {discountNum > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="text-ink2">Discount{order.discount_reason ? ` (${order.discount_reason})` : ""}</div>
              <div className="font-semibold text-statusNew">−{inr(discountNum)}</div>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-oat/50 gap-2 flex-wrap">
            <div className="text-ink2 font-semibold">Amount due</div>
            <div className="font-display text-3xl sm:text-4xl text-ink leading-none" data-testid="order-total">₹{amountDue.toFixed(0)}</div>
          </div>
          {order.payment_status === "paid" && (
            <div className="grid grid-cols-2 gap-2 text-sm pt-2">
              <div className="bg-bone rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-ink2 inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Cash</span>
                <span className="font-semibold">{inr(order.cash_amount)}</span>
              </div>
              <div className="bg-bone rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-ink2 inline-flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> UPI</span>
                <span className="font-semibold">{inr(order.upi_amount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment controls */}
        <div className="mt-4 border-t border-oat/70 pt-3 print:hidden" data-testid="payment-section">
          <div className="text-xs uppercase tracking-[0.18em] text-ink2/80 font-semibold mb-3">Payment</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink2/80">Discount (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                data-testid="discount-input"
                className="mt-1 w-full h-11 rounded-xl bg-bone border border-oat px-3 focus:outline-none focus:ring-2 focus:ring-sage/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink2/80">Discount reason</label>
              <input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. guest loyalty"
                data-testid="discount-reason-input"
                className="mt-1 w-full h-11 rounded-xl bg-bone border border-oat px-3 focus:outline-none focus:ring-2 focus:ring-sage/40"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {["pending", "paid"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPaymentStatus(s)}
                data-testid={`payment-status-${s}`}
                className={`h-11 rounded-xl border font-semibold text-sm btn-tactile capitalize ${paymentStatus === s ? (s === "paid" ? "bg-sage text-white border-sage" : "bg-tan text-white border-tan") : "bg-white border-oat text-ink2"}`}
              >
                {s}
              </button>
            ))}
          </div>

          {paymentStatus === "paid" && (
            <div className="mt-3 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink2/80 inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Cash (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    data-testid="cash-amount-input"
                    className="mt-1 w-full h-11 rounded-xl bg-bone border border-oat px-3 focus:outline-none focus:ring-2 focus:ring-sage/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink2/80 inline-flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> UPI (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={upiAmount}
                    onChange={(e) => setUpiAmount(e.target.value)}
                    data-testid="upi-amount-input"
                    className="mt-1 w-full h-11 rounded-xl bg-bone border border-oat px-3 focus:outline-none focus:ring-2 focus:ring-sage/40"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={fillAllCash} className="text-xs font-semibold text-sage-dark px-3 py-1.5 rounded-lg bg-cream border border-oat btn-tactile">All cash</button>
                <button type="button" onClick={fillAllUpi} className="text-xs font-semibold text-sage-dark px-3 py-1.5 rounded-lg bg-cream border border-oat btn-tactile">All UPI</button>
                <div className="w-full sm:w-auto sm:ml-auto text-xs text-ink2 self-center">
                  Split must total <strong>{inr(amountDue)}</strong>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={savePayment}
            disabled={busy}
            data-testid="save-payment-button"
            className="mt-4 w-full h-12 rounded-xl bg-sage text-white font-semibold inline-flex items-center justify-center gap-2 btn-tactile disabled:opacity-60"
          >
            <IndianRupee className="w-4 h-4" />
            {busy ? "Saving…" : paymentStatus === "paid" ? "Record payment" : "Update bill"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
