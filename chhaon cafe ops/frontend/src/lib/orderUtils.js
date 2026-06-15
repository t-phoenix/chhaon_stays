export const ITEM_STATUSES = [
  { key: "new", label: "New", sub: "Awaiting kitchen", chip: "bg-[#FDF0F0] text-[#D96C6C]", dot: "bg-[#D96C6C]" },
  { key: "preparing", label: "Preparing", sub: "On the stove", chip: "bg-[#FEF5EC] text-[#E6A15C]", dot: "bg-[#E6A15C]" },
  { key: "ready", label: "Ready", sub: "Pick up & serve", chip: "bg-[#F2F7F1] text-[#7B9E73]", dot: "bg-[#7B9E73]" },
  { key: "served", label: "Served", sub: "Closed out", chip: "bg-[#F5F6F5] text-[#A3A8A1]", dot: "bg-[#A3A8A1]" },
];

export const ITEM_STATUS_RANK = { new: 0, preparing: 1, ready: 2, served: 3 };
export const itemStatusRank = (status) => ITEM_STATUS_RANK[status] ?? 0;

/** Keep in-flight or ahead-of-server item statuses when a poll returns stale data. */
export function mergeOrdersFromServer(incoming, current, pendingKeys = new Set()) {
  const currentById = new Map((current || []).map((o) => [o.id, o]));
  return (incoming || []).map((serverOrder) => {
    const local = currentById.get(serverOrder.id);
    if (!local) return serverOrder;
    const mergedItems = (serverOrder.items || []).map((sItem) => {
      const key = `${serverOrder.id}:${sItem.line_id}`;
      const lItem = (local.items || []).find((i) => i.line_id === sItem.line_id);
      if (pendingKeys.has(key)) return lItem || sItem;
      if (lItem && itemStatusRank(lItem.status) > itemStatusRank(sItem.status)) return lItem;
      return sItem;
    });
    return { ...serverOrder, items: mergedItems };
  });
}

export function mergeOrderWithLocal(serverOrder, localOrder, pendingKeys = new Set()) {
  if (!localOrder) return serverOrder;
  const orderId = serverOrder.id;
  const mergedItems = (serverOrder.items || []).map((sItem) => {
    const key = `${orderId}:${sItem.line_id}`;
    const lItem = (localOrder.items || []).find((i) => i.line_id === sItem.line_id);
    if (pendingKeys.has(key)) return lItem || sItem;
    if (lItem && itemStatusRank(lItem.status) > itemStatusRank(sItem.status)) return lItem;
    return sItem;
  });
  return { ...serverOrder, items: mergedItems };
}

export function patchOrderItemStatus(orders, orderId, lineId, status) {
  return orders.map((o) => {
    if (o.id !== orderId) return o;
    return {
      ...o,
      items: (o.items || []).map((it) =>
        it.line_id === lineId ? { ...it, status } : it
      ),
    };
  });
}

export const NEXT_ITEM = { new: "preparing", preparing: "ready", ready: "served" };
export const NEXT_ITEM_LABEL = { new: "Start", preparing: "Ready", ready: "Served" };
export const NEXT_ITEM_LABEL_LONG = { new: "Start preparing", preparing: "Mark ready", ready: "Mark served" };

export const itemStatusChip = (status) =>
  ITEM_STATUSES.find((s) => s.key === status) || ITEM_STATUSES[0];

/** Flatten orders into per-line tickets for kitchen / item kanban */
export const flattenOrderItems = (orders) => {
  const tickets = [];
  for (const o of orders) {
    for (const it of o.items || []) {
      tickets.push({
        ticketKey: `${o.id}-${it.line_id}`,
        orderId: o.id,
        orderNo: o.order_no,
        lineId: it.line_id,
        guestName: o.guest_name,
        guestMobile: o.guest_mobile,
        roomNumber: o.room_number,
        walkIn: o.walk_in,
        notes: o.notes,
        createdAt: o.created_at,
        paymentStatus: o.payment_status,
        item: it,
      });
    }
  }
  return tickets;
};

export const groupTicketsByStatus = (tickets) => {
  const g = { new: [], preparing: [], ready: [], served: [] };
  for (const t of tickets) {
    const s = t.item?.status || "new";
    if (g[s]) g[s].push(t);
  }
  return g;
};

export const buildOrderItemPayload = (line) => {
  if (line.isMisc || line.misc) {
    return {
      line_id: line.lineId,
      custom_name: line.name,
      custom_price: line.price,
      quantity: line.qty,
    };
  }
  return {
    line_id: line.lineId,
    menu_item_id: line.id,
    quantity: line.qty,
  };
};

export const normalizeMobile = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return digits.slice(0, 10);
};

export const isValidMobile = (value) => normalizeMobile(value).length === 10;

export const formatGuestMobile = (value) => {
  const m = normalizeMobile(value);
  if (m.length !== 10) return value || "";
  return `${m.slice(0, 5)} ${m.slice(5)}`;
};

const orderDue = (o) => {
  const sub = Number(o.subtotal ?? o.total ?? 0);
  const disc = Number(o.discount_amount || 0);
  return Math.max(0, Math.round((sub - disc) * 100) / 100);
};

/** Group orders into guest running tabs (keyed by mobile). */
export const groupOrdersByGuest = (orders, { paymentStatus = "pending" } = {}) => {
  const map = new Map();
  for (const o of orders) {
    if (paymentStatus && o.payment_status !== paymentStatus) continue;
    const mobile = normalizeMobile(o.guest_mobile);
    if (!mobile) continue;
    if (!map.has(mobile)) {
      map.set(mobile, {
        guestMobile: mobile,
        guestName: o.guest_name,
        roomNumber: o.room_number,
        walkIn: o.walk_in,
        orders: [],
        orderCount: 0,
        subtotal: 0,
        amountDue: 0,
        activeItems: 0,
        firstOrderAt: o.created_at,
        lastOrderAt: o.created_at,
      });
    }
    const g = map.get(mobile);
    g.orders.push(o);
    g.orderCount += 1;
    g.subtotal += Number(o.subtotal ?? o.total ?? 0);
    g.amountDue += orderDue(o);
    g.activeItems += (o.items || []).filter((it) => (it.status || "new") !== "served").length;
    if (o.guest_name) g.guestName = o.guest_name;
    if (o.room_number) g.roomNumber = o.room_number;
    g.walkIn = o.walk_in;
    if (o.created_at < g.firstOrderAt) g.firstOrderAt = o.created_at;
    if (o.created_at > g.lastOrderAt) g.lastOrderAt = o.created_at;
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));
};

export const groupOrdersByDate = (orders) => {
  const byDate = {};
  for (const o of orders) {
    const key = (o.created_at || "").slice(0, 10);
    if (!key) continue;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(o);
  }
  return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
};

export const formatOrderDay = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const daysBetween = (fromIso, toIso = new Date().toISOString()) => {
  const a = new Date(fromIso).setHours(0, 0, 0, 0);
  const b = new Date(toIso).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000));
};
