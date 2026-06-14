import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/offline/api";
import { readCachedOrders } from "@/offline/sync";
import { toast } from "sonner";
import {
  Plus,
  Search,
  BedDouble,
  MapPin,
  Phone,
  Receipt,
  Users,
  ChefHat,
  Clock,
  Pencil,
} from "lucide-react";
import {
  groupOrdersByGuest,
  formatGuestMobile,
  normalizeMobile,
  daysBetween,
} from "@/lib/orderUtils";

const inr = (n) => `₹${Number(n).toFixed(0)}`;

const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const GuestMeta = ({ g }) => (
  <span className="inline-flex items-center gap-1 truncate">
    {g.walk_in ? (
      <><MapPin className="w-3 h-3 shrink-0" /> Walk-in</>
    ) : g.room_number ? (
      <><BedDouble className="w-3 h-3 shrink-0" /> R{g.room_number}</>
    ) : (
      "In-house"
    )}
  </span>
);

const Orders = () => {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("open");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/guests/ledger", {
        params: { payment_status: tab === "open" ? "pending" : "paid", limit: 150 },
      });
      setGuests(data);
    } catch (e) {
      try {
        const cached = await readCachedOrders();
        const grouped = groupOrdersByGuest(cached, {
          paymentStatus: tab === "open" ? "pending" : "paid",
        });
        setGuests(
          grouped.map((g) => ({
            guest_mobile: g.guestMobile,
            guest_name: g.guestName,
            room_number: g.roomNumber,
            walk_in: g.walkIn,
            order_count: g.orderCount,
            active_items: g.activeItems,
            subtotal: g.subtotal,
            amount_due: g.amountDue,
            first_order_at: g.firstOrderAt,
            last_order_at: g.lastOrderAt,
          }))
        );
      } catch {
        toast.error(formatApiError(e));
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return guests;
    return guests.filter((g) => {
      const mobile = normalizeMobile(g.guest_mobile);
      return (
        g.guest_name?.toLowerCase().includes(needle)
        || mobile.includes(needle.replace(/\D/g, ""))
        || (g.room_number || "").toLowerCase().includes(needle)
      );
    });
  }, [guests, q]);

  const totals = useMemo(() => ({
    guests: filtered.length,
    due: filtered.reduce((a, g) => a + Number(g.amount_due || 0), 0),
    orders: filtered.reduce((a, g) => a + Number(g.order_count || 0), 0),
    kitchen: filtered.reduce((a, g) => a + Number(g.active_items || 0), 0),
  }), [filtered]);

  const newOrderFor = (g) => {
    const params = new URLSearchParams({
      name: g.guest_name || "",
      mobile: g.guest_mobile || "",
    });
    if (g.room_number) params.set("room", g.room_number);
    if (g.walk_in) params.set("walk_in", "1");
    navigate(`/orders/new?${params.toString()}`);
  };

  const stats = [
    { label: "Tabs", value: totals.guests },
    { label: "Due", value: inr(totals.due) },
    { label: "Orders", value: totals.orders },
    { label: "Kitchen", value: totals.kitchen, icon: ChefHat },
  ];

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="min-w-0 flex-1">
          <div className="page-eyebrow">in-house guests</div>
          <h1 className="page-title">guest board</h1>
          <p className="page-subtitle">
            One view per guest — orders across multiple days roll into a single bill at checkout.
          </p>
        </div>
        <Link
          to="/orders/new"
          data-testid="new-order-button"
          className="page-header-actions inline-flex items-center gap-1.5 h-9 sm:h-12 px-3 sm:px-5 rounded-xl bg-ink text-white text-sm font-semibold btn-tactile shadow-soft"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New order</span>
        </Link>
      </div>

      <div className="stat-strip">
        {stats.map((s) => (
          <div key={s.label} className="stat-cell">
            <div className="stat-label flex items-center justify-center sm:justify-start gap-0.5">
              {s.icon && <s.icon className="w-3 h-3 hidden sm:block" />}
              {s.label}
            </div>
            <div className="stat-value text-center sm:text-left">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink2/70" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, mobile, room…"
            data-testid="guest-search-input"
            className="w-full h-9 sm:h-10 pl-9 pr-3 rounded-xl bg-white border border-oat/60 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          {[
            { key: "open", label: "Open", full: "Open tabs" },
            { key: "paid", label: "Done", full: "Settled" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`guest-tab-${t.key}`}
              className={`h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm btn-tactile whitespace-nowrap ${
                tab === t.key ? "bg-ink text-white" : "bg-white border border-oat/60 text-ink2"
              }`}
            >
              <span className="sm:hidden">{t.label}</span>
              <span className="hidden sm:inline">{t.full}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-xl bg-white/60 border border-oat/50 p-6 text-center text-sm text-ink2 animate-pulse">
          Loading…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl bg-cream/60 border border-dashed border-oat p-8 text-center">
          <Users className="w-8 h-8 text-ink2/50 mx-auto mb-2" />
          <div className="font-display text-2xl text-ink2">No {tab === "open" ? "open" : "settled"} tabs</div>
        </div>
      )}

      {/* Mobile: dense list */}
      <div className="md:hidden space-y-1.5">
        {filtered.map((g) => (
          <article
            key={g.guest_mobile}
            data-testid={`guest-card-${g.guest_mobile}`}
            className="guest-row"
          >
            <button
              type="button"
              onClick={() => navigate(`/guests/${g.guest_mobile}`)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-sm text-ink truncate">{g.guest_name}</span>
                <span className="font-display text-lg text-ink shrink-0">{inr(g.amount_due)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink2 mt-0.5">
                <span className="inline-flex items-center gap-0.5 font-medium text-ink/80">
                  <Phone className="w-3 h-3" />
                  {formatGuestMobile(g.guest_mobile)}
                </span>
                <GuestMeta g={g} />
                <span>{g.order_count} ord</span>
                {g.active_items > 0 && (
                  <span className="text-[#E6A15C] font-semibold">{g.active_items} kitchen</span>
                )}
                <span className="inline-flex items-center gap-0.5 text-ink2/70">
                  <Clock className="w-3 h-3" />{timeAgo(g.last_order_at)}
                </span>
              </div>
            </button>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/guests/${g.guest_mobile}`)}
                data-testid={`guest-bill-${g.guest_mobile}`}
                className="btn-icon text-sage-dark"
                title={tab === "open" ? "View bill" : "View history"}
              >
                <Receipt className="w-3.5 h-3.5" />
              </button>
              {tab === "open" && (
                <>
                  <button
                    type="button"
                    onClick={() => newOrderFor(g)}
                    data-testid={`guest-add-order-${g.guest_mobile}`}
                    className="btn-icon"
                    title="Add order"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/guests/${g.guest_mobile}?edit=1`)}
                    data-testid={`guest-edit-${g.guest_mobile}`}
                    className="btn-icon"
                    title="Edit guest"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Desktop: cards */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((g) => {
          const span = daysBetween(g.first_order_at, g.last_order_at);
          return (
            <article
              key={g.guest_mobile}
              data-testid={`guest-card-${g.guest_mobile}`}
              className="card p-4 hover:shadow-cardHover transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl text-ink leading-tight truncate">{g.guest_name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink2">
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      <Phone className="w-3.5 h-3.5" />
                      {formatGuestMobile(g.guest_mobile)}
                    </span>
                    <GuestMeta g={g} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-3xl text-ink leading-none">{inr(g.amount_due)}</div>
                  <div className="text-[10px] text-ink2 mt-0.5 uppercase tracking-wide font-semibold">tab</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="chip bg-paper text-ink2">{g.order_count} order{g.order_count !== 1 ? "s" : ""}</span>
                {span > 0 && <span className="chip bg-paper text-ink2">{span + 1} days</span>}
                {g.active_items > 0 && (
                  <span className="chip bg-[#FEF5EC] text-[#E6A15C]">
                    <ChefHat className="w-3 h-3" />
                    {g.active_items} kitchen
                  </span>
                )}
                <span className="chip bg-paper text-ink2 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeAgo(g.last_order_at)}
                </span>
              </div>

              <div className="mt-3 dense-toolbar">
                <button
                  onClick={() => navigate(`/guests/${g.guest_mobile}`)}
                  data-testid={`guest-bill-${g.guest_mobile}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-sage text-white text-sm font-semibold btn-tactile"
                >
                  <Receipt className="w-4 h-4" />
                  {tab === "open" ? "Bill" : "History"}
                </button>
                {tab === "open" && (
                  <>
                    <button
                      onClick={() => newOrderFor(g)}
                      data-testid={`guest-add-order-${g.guest_mobile}`}
                      className="btn-secondary h-9 px-3"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                    <button
                      onClick={() => navigate(`/guests/${g.guest_mobile}?edit=1`)}
                      data-testid={`guest-edit-${g.guest_mobile}`}
                      className="btn-icon"
                      title="Edit guest"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default Orders;
