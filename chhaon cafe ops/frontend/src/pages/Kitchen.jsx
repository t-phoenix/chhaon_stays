import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api, { formatApiError } from "@/offline/api";
import { onSyncChange } from "@/offline/sync";
import { toast } from "sonner";
import { ChefHat, Bell, Check, Clock, BedDouble, MapPin, Phone } from "lucide-react";
import {
  NEXT_ITEM,
  NEXT_ITEM_LABEL_LONG,
  flattenOrderItems,
  itemStatusChip,
  mergeOrdersFromServer,
  mergeOrderWithLocal,
  patchOrderItemStatus,
} from "@/lib/orderUtils";

const NEXT_ICON = { new: ChefHat, preparing: Bell, ready: Check };

const minutesAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

const Kitchen = () => {
  const [orders, setOrders] = useState([]);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const loadSeqRef = useRef(0);
  const pendingAdvancesRef = useRef(new Set());

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const { data } = await api.get("/orders", { params: { active_only: true, limit: 200 } });
      if (seq !== loadSeqRef.current) return;
      setOrders((prev) => mergeOrdersFromServer(data, prev, pendingAdvancesRef.current));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 7000);
    const unsub = onSyncChange(() => { load(); });
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [load]);

  const tickets = useMemo(() => {
    const all = flattenOrderItems(orders);
    return all
      .filter((t) => t.item.status !== "served")
      .sort((a, b) => {
        const prio = { new: 0, preparing: 1, ready: 2 };
        const pa = prio[a.item.status] ?? 99;
        const pb = prio[b.item.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }, [orders]);

  const counts = useMemo(() => ({
    new: tickets.filter((t) => t.item.status === "new").length,
    preparing: tickets.filter((t) => t.item.status === "preparing").length,
    ready: tickets.filter((t) => t.item.status === "ready").length,
  }), [tickets]);

  const advanceItem = async (ticket) => {
    const next = NEXT_ITEM[ticket.item.status];
    if (!next || busyKeys.has(ticket.ticketKey)) return;

    const prevStatus = ticket.item.status;
    pendingAdvancesRef.current.add(ticket.ticketKey);
    setBusyKeys((prev) => new Set(prev).add(ticket.ticketKey));
    setOrders((prev) => patchOrderItemStatus(prev, ticket.orderId, ticket.lineId, next));

    try {
      const { data } = await api.patch(`/orders/${ticket.orderId}/items/${ticket.lineId}/status`, { status: next });
      setOrders((prev) =>
        prev.map((x) => {
          if (x.id !== data.id) return x;
          return mergeOrderWithLocal(data, x, pendingAdvancesRef.current);
        })
      );
      toast.success(`${ticket.item.name} → ${next}`);
    } catch (e) {
      setOrders((prev) => patchOrderItemStatus(prev, ticket.orderId, ticket.lineId, prevStatus));
      toast.error(formatApiError(e));
    } finally {
      pendingAdvancesRef.current.delete(ticket.ticketKey);
      setBusyKeys((prev) => {
        const n = new Set(prev);
        n.delete(ticket.ticketKey);
        return n;
      });
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="min-w-0">
          <div className="page-eyebrow">heat & serve</div>
          <h1 className="page-title">the kitchen</h1>
          <p className="page-subtitle">Each dish ticket moves independently. Served items leave this view.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-wrap page-header-actions">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FDF0F0] text-[#D96C6C]"><span className="w-1.5 h-1.5 rounded-full bg-[#D96C6C]" />{counts.new} new</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FEF5EC] text-[#E6A15C]"><span className="w-1.5 h-1.5 rounded-full bg-[#E6A15C]" />{counts.preparing} prepping</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F2F7F1] text-[#7B9E73]"><span className="w-1.5 h-1.5 rounded-full bg-[#7B9E73]" />{counts.ready} ready</span>
        </div>
      </div>

      <div className="flex sm:hidden gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        <span className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FDF0F0] text-[#D96C6C]"><span className="w-1.5 h-1.5 rounded-full bg-[#D96C6C]" />{counts.new} new</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FEF5EC] text-[#E6A15C]"><span className="w-1.5 h-1.5 rounded-full bg-[#E6A15C]" />{counts.preparing} prepping</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F2F7F1] text-[#7B9E73]"><span className="w-1.5 h-1.5 rounded-full bg-[#7B9E73]" />{counts.ready} ready</span>
      </div>

      {loading && (
        <div className="font-display text-3xl text-sage animate-pulse">listening for orders…</div>
      )}

      {!loading && tickets.length === 0 && (
        <div className="card p-8 text-center">
          <div className="font-display text-3xl sm:text-4xl text-ink">all clear</div>
          <div className="text-sm text-ink2 mt-1">make some chai. enjoy the view.</div>
        </div>
      )}

      <div className="space-y-1.5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
        {tickets.map((t) => {
          const Icon = NEXT_ICON[t.item.status] || Check;
          const min = minutesAgo(t.createdAt);
          const urgent = min >= 12 && t.item.status !== "ready";
          const chip = itemStatusChip(t.item.status);
          const isBusy = busyKeys.has(t.ticketKey);
          return (
            <article
              key={t.ticketKey}
              data-testid={`kitchen-card-${t.ticketKey}`}
              className={`card p-3 sm:p-4 relative overflow-hidden ${urgent ? "border-statusNew/60 ring-1 ring-statusNew/30" : ""}`}
            >
              <div className="absolute top-0 left-0 right-0 h-1.5"
                style={{ background: t.item.status === "new" ? "#D96C6C" : t.item.status === "preparing" ? "#E6A15C" : "#7B9E73" }}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display text-xl sm:text-2xl text-ink leading-none">#{t.orderNo}</div>
                  <div className="text-xs text-ink2 truncate">{t.guestName}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`chip ${chip.chip}`}>{chip.label}</span>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${urgent ? "text-statusNew" : "text-ink2"}`}>
                    <Clock className="w-3 h-3" /> {min}m
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-ink2 flex flex-wrap gap-x-2 gap-y-1">
                {t.walkIn ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Walk-in</span> : <span className="inline-flex items-center gap-1"><BedDouble className="w-3 h-3" /> Rm {t.roomNumber || "—"}</span>}
                {t.guestMobile && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {t.guestMobile}</span>}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 min-w-0">
                <span className="font-semibold text-sm text-ink truncate">{t.item.quantity}× {t.item.name}</span>
              </div>

              {t.notes ? (
                <div className="mt-3 italic text-tan-dark bg-tan-light/15 border border-tan-light/40 px-3 py-2 rounded-xl text-sm">
                  “{t.notes}”
                </div>
              ) : null}

              <button
                data-testid={`kitchen-advance-${t.ticketKey}`}
                disabled={isBusy}
                onClick={() => advanceItem(t)}
                className="mt-2 w-full h-9 sm:h-10 rounded-xl bg-ink text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 btn-tactile disabled:opacity-60"
              >
                <Icon className="w-4 h-4" /> {isBusy ? "Saving…" : NEXT_ITEM_LABEL_LONG[t.item.status]}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default Kitchen;
