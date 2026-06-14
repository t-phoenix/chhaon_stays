export const STATUS_ORDER = ["new", "preparing", "ready", "served"];

const NEXT_ITEM = { new: "preparing", preparing: "ready", ready: "served" };

export function statusIndex(status) {
  const i = STATUS_ORDER.indexOf(status);
  return i >= 0 ? i : 0;
}

/** Accept forward transitions only; same status is no-op */
export function canAdvanceItemStatus(from, to, adminOverride = false) {
  if (from === to) return true;
  if (adminOverride) return true;
  return statusIndex(to) > statusIndex(from);
}

export function pickItemStatus(current, incoming, { adminOverride = false, lamportCurrent = 0, lamportIncoming = 0 } = {}) {
  if (current === incoming) return current;
  if (adminOverride && incoming) return incoming;
  const curIdx = statusIndex(current);
  const inIdx = statusIndex(incoming);
  if (inIdx > curIdx) return incoming;
  if (inIdx < curIdx) return current;
  return lamportIncoming >= lamportCurrent ? incoming : current;
}

/** Last-write-wins on whole order document by lamport */
export function mergeOrderLWW(local, remote, { lamportLocal = 0, lamportRemote = 0 } = {}) {
  if (!local) return { order: remote, winner: "remote" };
  if (!remote) return { order: local, winner: "local" };
  if (lamportRemote > lamportLocal) return { order: { ...remote }, winner: "remote" };
  if (lamportLocal > lamportRemote) return { order: { ...local }, winner: "local" };
  const localTs = Date.parse(local.updated_at || local.created_at || 0);
  const remoteTs = Date.parse(remote.updated_at || remote.created_at || 0);
  return remoteTs >= localTs ? { order: { ...remote }, winner: "remote" } : { order: { ...local }, winner: "local" };
}

export function mergeItemStatuses(localItems, remoteItems, opMeta = {}) {
  const byLine = new Map();
  for (const it of localItems || []) byLine.set(it.line_id, { ...it });
  for (const it of remoteItems || []) {
    const cur = byLine.get(it.line_id);
    if (!cur) {
      byLine.set(it.line_id, { ...it });
      continue;
    }
    const meta = opMeta[it.line_id] || {};
    byLine.set(it.line_id, {
      ...cur,
      ...it,
      status: pickItemStatus(cur.status, it.status, meta),
    });
  }
  return Array.from(byLine.values());
}

/** Item edits reset payment to pending per business rule */
export function applyPaymentResetOnItemChange(order, itemsChanged) {
  if (!itemsChanged || !order) return order;
  return {
    ...order,
    payment_status: "pending",
    cash_amount: 0,
    upi_amount: 0,
    paid_at: null,
  };
}

export function deriveOrderStatus(items) {
  const statuses = (items || []).map((i) => i.status || "new");
  if (!statuses.length) return "new";
  if (statuses.every((s) => s === "served")) return "served";
  if (statuses.some((s) => s === "ready")) return "ready";
  if (statuses.some((s) => s === "preparing")) return "preparing";
  return "new";
}

export function applyOpToOrder(order, op) {
  if (!op) return order;
  const action = op.action;
  const payload = op.payload || {};

  if (action === "delete") {
    return null;
  }

  if (action === "upsert" || action === "create") {
    const base = order || {};
    const merged = mergeOrderLWW(base, payload.order || payload, {
      lamportLocal: base._lamport || 0,
      lamportRemote: op.lamport,
    });
    let next = merged.order;
    if (order && payload.order?.items) {
      next = {
        ...next,
        items: mergeItemStatuses(order.items, payload.order.items),
      };
      next = applyPaymentResetOnItemChange(next, true);
    }
    next.status = deriveOrderStatus(next.items);
    next._lamport = Math.max(order?._lamport || 0, op.lamport);
    if (payload._conflict) next._conflict = true;
    return next;
  }

  if (action === "item_status") {
    if (!order) return null;
    const items = order.items.map((it) => {
      if (it.line_id !== payload.line_id) return it;
      const nextStatus = pickItemStatus(it.status, payload.status, {
        adminOverride: payload.admin_override,
        lamportCurrent: order._itemLamport?.[it.line_id] || 0,
        lamportIncoming: op.lamport,
      });
      return nextStatus === it.status ? it : { ...it, status: nextStatus };
    });
    const itemLamport = { ...(order._itemLamport || {}), [payload.line_id]: op.lamport };
    return {
      ...order,
      items,
      status: deriveOrderStatus(items),
      updated_at: op.ts || new Date().toISOString(),
      _itemLamport: itemLamport,
      _lamport: Math.max(order._lamport || 0, op.lamport),
    };
  }

  if (action === "payment") {
    if (!order) return null;
    const pay = payload.payment || payload;
    return {
      ...order,
      ...pay,
      payment_status: pay.payment_status || order.payment_status,
      updated_at: op.ts || new Date().toISOString(),
      _lamport: Math.max(order._lamport || 0, op.lamport),
    };
  }

  if (action === "id_remap") {
    if (!order) return null;
    if (order.id === payload.fromId) {
      return { ...order, id: payload.toId, order_no: payload.order_no ?? order.order_no, _pending: false, _offline: false };
    }
    return order;
  }

  return order;
}

export function buildOp({ deviceId, lamport, entity, entityId, action, payload }) {
  return {
    opId: crypto.randomUUID(),
    deviceId,
    lamport,
    entity,
    entityId,
    action,
    payload,
    ts: new Date().toISOString(),
  };
}

export function sortOps(ops) {
  return [...ops].sort((a, b) => {
    if (a.lamport !== b.lamport) return a.lamport - b.lamport;
    if (a.deviceId !== b.deviceId) return a.deviceId.localeCompare(b.deviceId);
    return a.opId.localeCompare(b.opId);
  });
}

export function replayOps(ordersById, ops) {
  const map = new Map(Object.entries(ordersById || {}));
  for (const op of sortOps(ops)) {
    const id = op.entityId;
    const cur = map.get(id);
    const next = applyOpToOrder(cur, op);
    if (next === null) map.delete(id);
    else map.set(next.id || id, next);
  }
  return Object.fromEntries(map);
}

export function nextAutoStatus(status) {
  return NEXT_ITEM[status] || status;
}
