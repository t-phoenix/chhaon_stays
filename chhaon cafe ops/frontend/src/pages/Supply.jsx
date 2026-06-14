import { useEffect, useMemo, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const QUICK = ["Milk", "Eggs", "Paneer", "Tomatoes", "Onions", "Tea Leaves", "Coffee Powder", "Bread", "Butter", "Sugar", "Flour", "Rice"];

const Supply = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState([]);
  const [aggregated, setAggregated] = useState([]);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/supply", { params: { limit: 200 } });
      setItems(data);
      if (isAdmin) {
        const { data: ag } = await api.get("/supply/aggregated");
        setAggregated(ag);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const add = async (name) => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await api.post("/supply", { item_name: n });
      setVal("");
      toast.success(`Added: ${n}`);
      await load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/supply/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (isAdmin) {
        const { data: ag } = await api.get("/supply/aggregated");
        setAggregated(ag);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all supply requests?")) return;
    try {
      await api.delete("/supply");
      toast.success("Cleared");
      setItems([]);
      setAggregated([]);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const uniqueRecent = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const k = it.item_name.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(it);
      }
    }
    return out.slice(0, 8);
  }, [items]);

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="min-w-0 flex-1">
          <div className="page-eyebrow">what's running low</div>
          <h1 className="page-title">supply runs</h1>
          <p className="page-subtitle">One-tap your needs. We'll bundle them for the next supply trip.</p>
        </div>
        {isAdmin && items.length > 0 && (
          <button onClick={clearAll} data-testid="supply-clear-all" className="page-header-actions hidden sm:inline-flex items-center gap-2 px-3 h-10 rounded-xl border border-oat bg-white text-ink2 text-sm font-semibold btn-tactile">
            <Trash2 className="w-4 h-4" /> Clear all
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            data-testid="supply-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(val); }}
            placeholder="e.g. milk, eggs, paneer…"
            className="flex-1 min-w-0 h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage"
          />
          <button
            data-testid="supply-add-button"
            disabled={busy || !val.trim()}
            onClick={() => add(val)}
            className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-ink text-white font-semibold btn-tactile disabled:opacity-60 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.14em] font-semibold text-ink2/80 mb-2">quick add</div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                data-testid={`supply-quick-${q.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => add(q)}
                className="px-3 h-9 rounded-full bg-cream text-ink2 text-sm font-semibold hover:bg-oat/70 btn-tactile"
              >
                + {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Admin aggregated view */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft mb-5">
          <div className="font-display text-3xl text-ink leading-none mb-3">to procure</div>
          {aggregated.length === 0 ? (
            <div className="text-ink2 text-sm">no pending requests. 🙌</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aggregated.map((a) => (
                <div key={a.item_name} data-testid={`aggregated-${a.item_name}`} className="flex items-center justify-between bg-bone rounded-xl border border-oat/60 px-4 py-3">
                  <div>
                    <div className="font-semibold text-ink">{a.item_name}</div>
                    <div className="text-xs text-ink2">last by {a.last_requested_by}</div>
                  </div>
                  <div className="inline-flex items-center justify-center min-w-8 h-8 px-3 rounded-full bg-sage text-white font-bold text-sm">{a.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent requests */}
      <div className="bg-white rounded-2xl border border-oat/60 p-5 shadow-soft">
        <div className="font-display text-3xl text-ink leading-none mb-3">recent requests</div>
        {items.length === 0 ? (
          <div className="rounded-xl bg-cream/60 border border-dashed border-oat p-6 text-center">
            <div className="font-display text-2xl text-ink2">nothing logged yet</div>
            <div className="text-xs text-ink2/70 mt-1">use quick add or type something above</div>
          </div>
        ) : (
          <div className="divide-y divide-oat/60">
            {items.map((it) => (
              <div key={it.id} data-testid={`supply-row-${it.id}`} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate">{it.item_name}</div>
                  <div className="text-xs text-ink2">by {it.requested_by_name} · {new Date(it.created_at).toLocaleString()}</div>
                </div>
                {isAdmin && (
                  <button onClick={() => remove(it.id)} data-testid={`supply-delete-${it.id}`} className="w-9 h-9 rounded-lg border border-oat hover:bg-statusNew/5 inline-flex items-center justify-center text-statusNew btn-tactile">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Supply;
