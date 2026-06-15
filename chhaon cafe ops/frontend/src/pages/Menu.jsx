import { useEffect, useMemo, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Search, Edit3, Trash2, X } from "lucide-react";
import ToggleSwitch from "@/components/ToggleSwitch";

const Menu = () => {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState({});
  const [togglingIds, setTogglingIds] = useState(() => new Set());

  const displayActive = useCallback(
    (m) => (optimisticActive[m.id] !== undefined ? optimisticActive[m.id] : m.active),
    [optimisticActive]
  );

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/menu");
      setItems(data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((m) => m.category)))], [items]);
  const filtered = items.filter((m) => (cat === "All" || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()));

  const toggleActive = async (m) => {
    if (togglingIds.has(m.id)) return;
    const targetActive = !displayActive(m);
    setOptimisticActive((prev) => ({ ...prev, [m.id]: targetActive }));
    setTogglingIds((prev) => new Set(prev).add(m.id));
    try {
      const { data } = await api.patch(`/menu/${m.id}`, { active: targetActive });
      setItems((prev) => prev.map((x) => (x.id === m.id ? data : x)));
      setOptimisticActive((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
    } catch (e) {
      setOptimisticActive((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      toast.error(
        !navigator.onLine
          ? "No internet — menu changes need a connection"
          : formatApiError(e)
      );
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(m.id);
        return next;
      });
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try {
      await api.delete(`/menu/${m.id}`);
      setItems((prev) => prev.filter((x) => x.id !== m.id));
      toast.success("Item removed");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const save = async (form) => {
    setBusy(true);
    try {
      if (form.id) {
        const { data } = await api.patch(`/menu/${form.id}`, { name: form.name, category: form.category, price: parseFloat(form.price), active: form.active });
        setItems((prev) => prev.map((x) => (x.id === form.id ? data : x)));
        toast.success("Saved");
      } else {
        const { data } = await api.post(`/menu`, { name: form.name, category: form.category, price: parseFloat(form.price), active: form.active });
        setItems((prev) => [...prev, data]);
        toast.success("Item added");
      }
      setEditing(null);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const m of filtered) {
      g[m.category] = g[m.category] || [];
      g[m.category].push(m);
    }
    return g;
  }, [filtered]);

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="min-w-0">
          <div className="page-eyebrow">today&apos;s offerings</div>
          <h1 className="page-title">the menu</h1>
        </div>
        <button
          data-testid="add-menu-button"
          onClick={() => setEditing({ name: "", category: "", price: 0, active: true })}
          className="page-header-actions inline-flex items-center gap-2 h-11 sm:h-12 px-4 sm:px-5 rounded-xl bg-ink text-white text-sm font-semibold btn-tactile shadow-soft"
        >
          <Plus className="w-4 h-4" /> New item
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-oat/60 p-4 shadow-soft mb-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink2/70" />
          <input
            data-testid="menu-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menu items…"
            className="w-full pl-11 h-12 rounded-xl bg-bone border border-oat focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              data-testid={`menu-cat-${c.toLowerCase().replace(/\s+/g, "-")}`}
              className={`px-3 h-9 rounded-full text-sm font-semibold whitespace-nowrap btn-tactile ${cat === c ? "bg-ink text-white" : "bg-cream text-ink2 hover:bg-oat/70"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {Object.keys(grouped).length === 0 && (
          <div className="rounded-2xl bg-cream/60 border border-dashed border-oat p-8 text-center">
            <div className="font-display text-3xl text-ink2">nothing here yet</div>
            <div className="text-sm text-ink2/80 mt-1">tap &ldquo;New item&rdquo; to add your first dish</div>
          </div>
        )}
        {Object.entries(grouped).map(([category, list]) => (
          <section key={category}>
            <div className="font-display text-3xl text-ink mb-2">{category}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((m) => {
                const isActive = displayActive(m);
                const isToggling = togglingIds.has(m.id);
                return (
                  <div
                    key={m.id}
                    data-testid={`menu-row-${m.id}`}
                    className={`bg-white rounded-2xl border p-4 shadow-soft transition-all ${isActive ? "border-oat/60" : "border-oat/40"}`}
                  >
                    <div className={`transition-opacity ${isActive ? "" : "opacity-60"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{m.name}</div>
                          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2/80 font-semibold mt-0.5">{m.category}</div>
                        </div>
                        <div className="font-display text-2xl text-ink leading-none">₹{m.price}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          active={isActive}
                          disabled={isToggling}
                          testId={`menu-active-${m.id}`}
                          onToggle={() => toggleActive(m)}
                        />
                        <span className={`text-xs font-semibold min-w-[2.25rem] ${isActive ? "text-sage" : "text-ink2"}`}>
                          {isToggling ? "…" : isActive ? "Active" : "Off"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          data-testid={`menu-edit-${m.id}`}
                          onClick={() => setEditing(m)}
                          className="w-9 h-9 rounded-lg bg-white border border-oat hover:bg-cream inline-flex items-center justify-center btn-tactile"
                        >
                          <Edit3 className="w-4 h-4 text-ink2" />
                        </button>
                        <button
                          data-testid={`menu-delete-${m.id}`}
                          onClick={() => remove(m)}
                          className="w-9 h-9 rounded-lg bg-white border border-oat hover:bg-statusNew/5 inline-flex items-center justify-center text-statusNew btn-tactile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <MenuModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          busy={busy}
          existingCategories={categories.filter((c) => c !== "All")}
        />
      )}
    </div>
  );
};

const MenuModal = ({ initial, onClose, onSave, busy, existingCategories }) => {
  const [name, setName] = useState(initial.name || "");
  const [category, setCategory] = useState(initial.category || "");
  const [price, setPrice] = useState(initial.price ?? 0);
  const [active, setActive] = useState(initial.active ?? true);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-[480px] bg-white rounded-t-3xl sm:rounded-3xl border border-oat/60 p-5 sm:p-6 shadow-floating animate-fade-up max-h-[min(92vh,100dvh)] overflow-y-auto safe-bottom sm:mt-16">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-ink2/80 font-semibold">{initial.id ? "edit" : "new"}</div>
            <h2 className="font-display text-4xl text-ink leading-none mt-1">{initial.id ? "edit item" : "new item"}</h2>
          </div>
          <button onClick={onClose} data-testid="menu-modal-close" className="w-9 h-9 rounded-xl bg-cream inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="menu-name-input"
              className="mt-1.5 w-full h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Category</label>
            <input
              list="cat-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Breakfast / Beverages / Chinese / Main Course / Snacks"
              data-testid="menu-category-input"
              className="mt-1.5 w-full h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage"
            />
            <datalist id="cat-list">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.12em] font-semibold text-ink2/80">Price (₹)</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-testid="menu-price-input"
              className="mt-1.5 w-full h-12 rounded-xl bg-bone border border-oat px-4 focus:outline-none focus:ring-2 focus:ring-sage/40 focus:border-sage"
            />
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              active={active}
              size="md"
              testId="menu-active-toggle"
              onToggle={() => setActive((v) => !v)}
            />
            <span className="text-sm font-semibold text-ink">
              {active ? "Active" : "Off"}
              <span className="text-ink2/70 font-normal"> — shows in new order</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => onSave({ id: initial.id, name: name.trim(), category: category.trim(), price, active })}
          disabled={busy || !name.trim() || !category.trim()}
          data-testid="menu-save-button"
          className="mt-6 w-full h-12 rounded-xl bg-ink text-white font-semibold btn-tactile disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};

export default Menu;
