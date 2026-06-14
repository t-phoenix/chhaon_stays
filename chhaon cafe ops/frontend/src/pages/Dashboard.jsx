import { useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { TrendingUp, IndianRupee, ShoppingBag, Coffee, ArrowRight, Banknote, Smartphone, Percent, Clock } from "lucide-react";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
];

const inr = (n) => `₹${Number(n).toFixed(0)}`;

const Dashboard = () => {
  const [range, setRange] = useState("today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard", { params: { range: r } });
      setData(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const maxQty = Math.max(1, ...(data?.top_items?.map((i) => i.quantity) || [1]));

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="min-w-0">
          <div className="page-eyebrow">a quiet look at the day</div>
          <h1 className="page-title">reports</h1>
        </div>
        <div className="flex gap-1.5 sm:gap-2 bg-cream rounded-xl p-1 overflow-x-auto no-scrollbar max-w-full">
          {RANGES.map((r) => (
            <button
              key={r.key}
              data-testid={`range-${r.key}`}
              onClick={() => setRange(r.key)}
              className={`px-3 h-9 rounded-lg text-sm font-semibold btn-tactile whitespace-nowrap shrink-0 ${range === r.key ? "bg-ink text-white" : "text-ink2 hover:bg-white"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi icon={ShoppingBag} label="Orders" value={data?.total_orders ?? "—"} loading={loading} testid="kpi-orders" />
        <Kpi icon={IndianRupee} label="Collected" value={data ? inr(data.revenue_collected) : "—"} sub="paid bills" loading={loading} testid="kpi-collected" />
        <Kpi icon={Clock} label="Pending" value={data ? inr(data.pending_total) : "—"} sub={`${data?.pending_count ?? 0} bills`} loading={loading} testid="kpi-pending" />
        <Kpi icon={TrendingUp} label="Avg order value" value={data ? inr(data.average_order_value) : "—"} loading={loading} testid="kpi-aov" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={Banknote} label="Cash" value={data ? inr(data.cash_collected) : "—"} loading={loading} testid="kpi-cash" />
        <Kpi icon={Smartphone} label="UPI" value={data ? inr(data.upi_collected) : "—"} loading={loading} testid="kpi-upi" />
        <Kpi icon={Percent} label="Discounts" value={data ? inr(data.discount_total) : "—"} loading={loading} testid="kpi-discount" />
        <Kpi icon={Coffee} label="Revenue (served)" value={data ? inr(data.revenue_served) : "—"} sub="kitchen closed" loading={loading} testid="kpi-revenue" />
      </div>

      {/* Status breakdown */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft">
          <div className="font-display text-3xl text-ink leading-none">orders by status</div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <StatusBox color="#D96C6C" bg="#FDF0F0" label="New" value={data?.status_counts?.new ?? 0} />
            <StatusBox color="#E6A15C" bg="#FEF5EC" label="Preparing" value={data?.status_counts?.preparing ?? 0} />
            <StatusBox color="#7B9E73" bg="#F2F7F1" label="Ready" value={data?.status_counts?.ready ?? 0} />
            <StatusBox color="#A3A8A1" bg="#F5F6F5" label="Served" value={data?.status_counts?.served ?? 0} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft">
          <div className="font-display text-3xl text-ink leading-none">payment status</div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <StatusBox color="#E6A15C" bg="#FEF5EC" label="Pending" value={data?.payment_counts?.pending ?? 0} />
            <StatusBox color="#7B9E73" bg="#F2F7F1" label="Paid" value={data?.payment_counts?.paid ?? 0} />
          </div>
          <div className="mt-4 text-sm text-ink2">
            Cash + UPI split: <strong>{data ? inr(data.cash_collected) : "—"}</strong> cash · <strong>{data ? inr(data.upi_collected) : "—"}</strong> UPI
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft">
          <div className="font-display text-3xl text-ink leading-none">top dishes</div>
          {(!data || data.top_items.length === 0) ? (
            <div className="text-ink2 mt-3 text-sm">nothing ordered yet in this range.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {data.top_items.map((i) => (
                <div key={i.name} data-testid={`top-item-${i.name}`} className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="text-sm font-semibold text-ink w-24 sm:w-40 truncate shrink-0">{i.name}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-cream overflow-hidden">
                    <div className="h-full bg-sage rounded-full" style={{ width: `${(i.quantity / maxQty) * 100}%` }} />
                  </div>
                  <div className="text-sm font-bold text-ink2 w-10 text-right">{i.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="font-display text-3xl text-ink leading-none">recent orders</div>
          <Link to="/orders" className="text-sm font-semibold text-sage-dark inline-flex items-center gap-1" data-testid="view-all-orders">
            view all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="mt-3 divide-y divide-oat/60">
          {(!data || data.recent_orders.length === 0) && (
            <div className="text-ink2 py-4 text-sm">no orders yet.</div>
          )}
          {data?.recent_orders?.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="py-3 flex items-center justify-between gap-3 hover:bg-cream/50 rounded-xl px-2 -mx-2 min-w-0" data-testid={`recent-${o.id}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink truncate">#{o.order_no} · {o.guest_name}</div>
                <div className="text-xs text-ink2">{o.items.length} item{o.items.length>1?"s":""} · {o.walk_in ? "Walk-in" : (o.room_number ? `Rm ${o.room_number}` : "In-house")}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl text-ink leading-none">₹{Number(o.total).toFixed(0)}</div>
                <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink2/80">
                  {o.status} · {o.payment_status === "paid" ? "paid" : "pending"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ icon: Icon, label, value, sub, loading, testid }) => (
  <div data-testid={testid} className="bg-white rounded-2xl border border-oat/60 p-4 sm:p-5 shadow-soft min-w-0">
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-9 h-9 rounded-xl bg-cream inline-flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-sage-dark" />
      </span>
      <div className="text-xs uppercase tracking-[0.14em] font-semibold text-ink2/80 truncate">{label}</div>
    </div>
    <div className="font-display text-3xl sm:text-4xl text-ink leading-none mt-3 break-words">{loading ? "…" : value}</div>
    {sub && <div className="text-xs text-ink2 mt-1">{sub}</div>}
  </div>
);

const StatusBox = ({ color, bg, label, value }) => (
  <div className="rounded-xl border border-oat/60 px-4 py-3 flex items-center justify-between" style={{ background: bg }}>
    <div className="text-sm font-semibold" style={{ color }}>{label}</div>
    <div className="font-display text-3xl leading-none" style={{ color }}>{value}</div>
  </div>
);

export default Dashboard;
