import { ShoppingBag, Send, Save } from "lucide-react";

const MobileCartBar = ({
  total,
  totalCount,
  onOpenCart,
  onSubmit,
  busy,
  canSubmit,
  submitLabel = "Send",
  submitIcon: SubmitIcon = Send,
}) => (
  <div className="lg:hidden fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 bg-bone/95 backdrop-blur border-t border-oat px-3 py-2 flex items-center gap-2 safe-bottom">
    <button
      type="button"
      onClick={onOpenCart}
      data-testid="mobile-cart-bar-open"
      className="relative btn-secondary h-10 px-3 shrink-0"
    >
      <ShoppingBag className="w-4 h-4" />
      {totalCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-tan text-white rounded-full text-[10px] font-bold inline-flex items-center justify-center">
          {totalCount}
        </span>
      )}
    </button>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] text-ink2 uppercase font-semibold">{totalCount} item{totalCount !== 1 ? "s" : ""}</div>
      <div className="font-display text-xl text-ink leading-none">₹{total.toFixed(0)}</div>
    </div>
    <button
      type="button"
      onClick={onSubmit}
      disabled={busy || !canSubmit}
      data-testid="mobile-cart-bar-submit"
      className="btn-primary h-10 px-4 shrink-0"
    >
      <SubmitIcon className="w-4 h-4" />
      <span className="hidden min-[360px]:inline">{busy ? "…" : submitLabel}</span>
    </button>
  </div>
);

export default MobileCartBar;
