import { Search, Plus, Minus, Sparkles } from "lucide-react";

const inr = (n) => `₹${Number(n).toFixed(0)}`;

const QtyControl = ({ qty, onDec, onInc, onAdd, itemId, testPrefix = "" }) => {
  if (qty === 0) {
    return (
      <button
        type="button"
        data-testid={`${testPrefix}add-item-${itemId}`}
        onClick={onAdd}
        className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-ink text-white text-xs font-semibold btn-tactile shrink-0"
      >
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 bg-cream rounded-lg p-0.5 shrink-0">
      <button type="button" data-testid={`${testPrefix}dec-item-${itemId}`} onClick={onDec} className="w-8 h-8 rounded-md bg-white border border-oat inline-flex items-center justify-center btn-tactile">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span data-testid={`${testPrefix}qty-item-${itemId}`} className="font-display text-lg text-ink min-w-6 text-center leading-none">{qty}</span>
      <button type="button" data-testid={`${testPrefix}inc-item-${itemId}`} onClick={onInc} className="w-8 h-8 rounded-md bg-sage text-white inline-flex items-center justify-center btn-tactile">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const MenuSection = ({
  categories,
  cat,
  setCat,
  q,
  setQ,
  filtered,
  cart,
  setQty,
  miscName,
  setMiscName,
  miscPrice,
  setMiscPrice,
  onAddMisc,
  searchTestId = "menu-search-input",
  testPrefix = "",
}) => (
  <div className="space-y-3">
    <div className="card p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-tan shrink-0" />
        <span className="text-sm font-semibold text-ink">Misc item</span>
      </div>
      <div className="grid grid-cols-[1fr_5rem_auto] gap-1.5">
        <input value={miscName} onChange={(e) => setMiscName(e.target.value)} placeholder="Custom name" data-testid="misc-name-input" className="input" />
        <input type="number" min={0} value={miscPrice} onChange={(e) => setMiscPrice(e.target.value)} placeholder="₹" data-testid="misc-price-input" className="input" />
        <button type="button" onClick={onAddMisc} data-testid="misc-add-button" className="h-9 px-3 rounded-xl bg-tan text-white text-sm font-semibold btn-tactile">Add</button>
      </div>
    </div>

    <div className="card p-3">
      <div className="relative">
        <Search className="input-icon left-3" />
        <input
          data-testid={searchTestId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search menu…"
          className="input pl-9"
        />
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            data-testid={`${testPrefix}cat-chip-${c.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setCat(c)}
            className={`px-2.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap btn-tactile ${cat === c ? "bg-ink text-white" : "bg-cream text-ink2"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>

    {filtered.length === 0 && (
      <div className="rounded-xl bg-cream/60 border border-dashed border-oat p-5 text-center text-sm text-ink2">
        Nothing matches
      </div>
    )}

    {/* Mobile: dense list */}
    <div className="md:hidden space-y-1">
      {filtered.map((m) => {
        const qty = cart[m.id] || 0;
        return (
          <div
            key={m.id}
            data-testid={`${testPrefix}menu-item-${m.id}`}
            className={`menu-row ${qty > 0 ? "border-sage/60 bg-[#F2F7F1]/30" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink truncate">{m.name}</div>
              <div className="text-[10px] text-ink2 uppercase tracking-wide">{m.category}</div>
            </div>
            <div className="font-display text-lg text-ink shrink-0">{inr(m.price)}</div>
            <QtyControl
              qty={qty}
              itemId={m.id}
              testPrefix={testPrefix}
              onAdd={() => setQty(m.id, 1)}
              onDec={() => setQty(m.id, -1)}
              onInc={() => setQty(m.id, 1)}
            />
          </div>
        );
      })}
    </div>

    {/* Desktop: card grid */}
    <div className="hidden md:grid md:grid-cols-2 gap-2">
      {filtered.map((m) => {
        const qty = cart[m.id] || 0;
        return (
          <div key={m.id} data-testid={`${testPrefix}menu-item-${m.id}`} className={`card p-3 ${qty > 0 ? "border-sage" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{m.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-ink2 mt-0.5">{m.category}</div>
              </div>
              <div className="font-display text-xl text-ink leading-none">{inr(m.price)}</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <QtyControl
                qty={qty}
                itemId={m.id}
                testPrefix={testPrefix}
                onAdd={() => setQty(m.id, 1)}
                onDec={() => setQty(m.id, -1)}
                onInc={() => setQty(m.id, 1)}
              />
              <div className="text-xs font-semibold text-ink2">{qty > 0 ? inr(m.price * qty) : ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default MenuSection;
