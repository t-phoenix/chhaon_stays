import { Link } from "react-router-dom";
import { BedDouble, Phone, Receipt } from "lucide-react";
import { formatGuestMobile, isValidMobile, normalizeMobile } from "@/lib/orderUtils";

const GuestFields = ({
  guestName,
  setGuestName,
  guestMobile,
  setGuestMobile,
  roomNumber,
  setRoomNumber,
  walkIn,
  setWalkIn,
  openTab,
  nameTestId = "guest-name-input",
  mobileTestId = "guest-mobile-input",
  roomTestId = "room-number-input",
  walkInTestId = "walk-in-toggle",
}) => (
  <div className="card p-3 sm:p-4 space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2 sm:col-span-1">
        <label className="field-label">Guest name <span className="text-statusNew">*</span></label>
        <input
          data-testid={nameTestId}
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Riya Sharma"
          required
          className="input mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="field-label">Mobile <span className="text-statusNew">*</span></label>
        <div className="input-icon-wrap">
          <Phone className="input-icon" />
          <input
            data-testid={mobileTestId}
            inputMode="numeric"
            value={guestMobile}
            onChange={(e) => setGuestMobile(normalizeMobile(e.target.value))}
            placeholder="10-digit"
            required
            className="input-with-icon"
          />
        </div>
        {guestMobile && !isValidMobile(guestMobile) && (
          <p className="text-[11px] text-statusNew mt-0.5">Enter all 10 digits</p>
        )}
      </div>
      <div>
        <label className="field-label">Room</label>
        <div className="input-icon-wrap">
          <BedDouble className="input-icon" />
          <input
            data-testid={roomTestId}
            disabled={walkIn}
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="102"
            className="input-with-icon disabled:opacity-50"
          />
        </div>
      </div>
      <label className="flex items-end gap-2 pb-1 select-none cursor-pointer text-sm font-semibold text-ink">
        <input
          type="checkbox"
          data-testid={walkInTestId}
          checked={walkIn}
          onChange={(e) => {
            setWalkIn(e.target.checked);
            if (e.target.checked) setRoomNumber("");
          }}
          className="w-4 h-4 rounded border-oat text-sage focus:ring-sage/40"
        />
        Walk-in
      </label>
    </div>

    {openTab && (
      <div className="rounded-lg bg-[#F2F7F1] border border-[#7B9E73]/30 p-2.5 text-xs">
        <div className="font-semibold text-ink">
          Open tab · {openTab.guest_name}
          <span className="text-ink2 font-normal"> ({formatGuestMobile(openTab.guest_mobile)})</span>
        </div>
        <p className="text-ink2 mt-0.5">
          {openTab.order_count} order{openTab.order_count !== 1 ? "s" : ""} · ₹{Number(openTab.amount_due).toFixed(0)} due
        </p>
        <Link to={`/guests/${openTab.guest_mobile}`} className="text-[11px] font-semibold text-sage-dark mt-1 inline-flex items-center gap-1">
          <Receipt className="w-3 h-3" /> View bill
        </Link>
      </div>
    )}
  </div>
);

export default GuestFields;
