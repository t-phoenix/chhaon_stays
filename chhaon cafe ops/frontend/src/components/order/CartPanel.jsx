import { Send, Save, Trash2 } from "lucide-react";

const CartPanel = ({
  cartLines,
  total,
  notes,
  setNotes,
  onRemove,
  onChangeQty,
  onSubmit,
  busy,
  embedded = false,
  className = "",
  testId = "cart-panel",
  submitLabel = "Send to kitchen",
  submitIcon: SubmitIcon = Send,
  busyLabel = "Sending…",
  totalLabel = "Grand total",
  notesTestId = "order-notes-input",
  submitTestId = "submit-order-button",
}) => (
  <aside data-testid={testId} className={`${embedded ? "" : "card p-3 sm:p-4"} ${className}`}>
    {!embedded && (
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display text-2xl sm:text-3xl text-ink leading-none">Cart</div>
        <div className="text-[10px] text-ink2 font-semibold uppercase tracking-wide">
          {cartLines.length} item{cartLines.length !== 1 ? "s" : ""}
        </div>
      </div>
    )}
    {cartLines.length === 0 ? (
      <div className="rounded-xl bg-cream/60 border border-dashed border-oat p-4 text-center text-sm text-ink2">
        Add at least one item
      </div>
    ) : (
      <div className="space-y-1.5">
        {cartLines.map((l) => (
          <div key={l.lineId || l.id} data-testid={`cart-line-${l.id}`} className="flex items-center justify-between gap-2 bg-bone border border-oat/60 rounded-lg px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-semibold text-ink truncate">{l.name}{l.isMisc ? " · misc" : ""}</div>
              <div className="text-[11px] text-ink2">₹{l.price}{l.category ? ` · ${l.category}` : ""}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={l.qty}
                onChange={(e) => onChangeQty(l.id, e.target.value, l.isMisc)}
                className="w-12 h-9 text-center rounded-lg bg-white border border-oat font-semibold text-sm text-ink"
              />
              <button type="button" onClick={() => onRemove(l.id, l.isMisc)} className="btn-icon w-8 h-8 text-statusNew border-statusNew/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
    <div className="mt-3">
      <label className="field-label">Kitchen notes</label>
      <textarea
        data-testid={notesTestId}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="less spicy, no onion…"
        className="input mt-1 min-h-[4.5rem] py-2 resize-y"
      />
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-oat/70 pt-2">
      <div className="text-ink2 text-xs sm:text-sm">{totalLabel}</div>
      <div className="font-display text-2xl sm:text-3xl text-ink leading-none" data-testid="cart-total">₹{total.toFixed(0)}</div>
    </div>
    <button
      type="button"
      onClick={onSubmit}
      disabled={busy || cartLines.length === 0}
      data-testid={submitTestId}
      className="mt-3 w-full h-10 sm:h-11 rounded-xl bg-ink text-white font-semibold inline-flex items-center justify-center gap-2 btn-tactile disabled:opacity-60 text-sm"
    >
      <SubmitIcon className="w-4 h-4" /> {busy ? busyLabel : submitLabel}
    </button>
  </aside>
);

export default CartPanel;
