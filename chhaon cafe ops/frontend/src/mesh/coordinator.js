import axios from "axios";
import {
  bumpLamport,
  dequeueMutation,
  enqueueMutation,
  getAllOrders,
  getQueue,
  makeLocalId,
  makeOpId,
  pruneMeshOps,
  saveMenu,
  saveOrders,
  setMeta,
  upsertOrder,
} from "@/offline/db";
import {
  startDiscovery,
  stopDiscovery,
  listDiscoveredPeers,
  connectToPeer,
  fetchMeshPinFromCloud,
  onPeerChange,
  isDiscoveryRunning,
} from "@/mesh/discovery";
import {
  startMeshTransport,
  stopMeshTransport,
  gossipOp,
  makeLocalOp,
  ingestRemoteOp,
  connectToDiscoveredPeer,
  getConnectedPeerCount,
  setMeshTransportCallbacks,
  requestCatchUp,
} from "@/mesh/transport";
import { buildOp } from "@/mesh/merge";
import { getOrCreateDeviceId } from "@/mesh/device";
import { attachAuthInterceptor } from "@/lib/authStorage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const rawApi = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});
attachAuthInterceptor(rawApi);

let syncing = false;
let meshStarted = false;
let listeners = new Set();
let peerPollTimer = null;

export function onSyncChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export async function pingBackend() {
  if (!isOnline()) return false;
  try {
    const { data } = await rawApi.get("/health", { timeout: 4000 });
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function getPendingCount() {
  const q = await getQueue();
  return q.length;
}

export function getMeshStatus() {
  return {
    active: meshStarted,
    discovery: isDiscoveryRunning(),
    peers: getConnectedPeerCount(),
  };
}

async function recordAndGossipOp({ entity, entityId, action, payload }) {
  const lamport = await bumpLamport();
  const deviceId = await getOrCreateDeviceId();
  const op = buildOp({ deviceId, lamport, entity, entityId, action, payload });
  op.opId = makeOpId();
  await gossipOp(op);
  return op;
}

async function applyOptimisticOrder(body, localId) {
  const now = new Date().toISOString();
  const items = (body.items || []).map((it, idx) => ({
    line_id: it.line_id || `local_line_${idx}`,
    menu_item_id: it.menu_item_id || `misc_local_${idx}`,
    name: it.custom_name || "Item",
    category: it.custom_name ? "Miscellaneous" : "Menu",
    price: Number(it.custom_price ?? 0),
    quantity: it.quantity,
    line_total: Number(it.custom_price ?? 0) * it.quantity,
    status: "new",
    is_misc: Boolean(it.custom_name),
  }));
  const subtotal = items.reduce((a, b) => a + b.line_total, 0);
  const order = {
    id: localId,
    order_no: 0,
    guest_name: body.guest_name,
    guest_mobile: body.guest_mobile || null,
    room_number: body.room_number,
    walk_in: body.walk_in,
    notes: body.notes || "",
    items,
    status: "new",
    subtotal,
    total: subtotal,
    payment_status: "pending",
    cash_amount: 0,
    upi_amount: 0,
    created_at: now,
    updated_at: now,
    _offline: true,
    _pending: true,
  };
  await upsertOrder(order);
  await recordAndGossipOp({
    entity: "order",
    entityId: localId,
    action: "upsert",
    payload: { order },
  });
  return order;
}

export async function cacheOrdersFromServer(orders) {
  await saveOrders(orders.map((o) => ({ ...o, _offline: false, _pending: false })));
  await setMeta("orders_cached_at", Date.now());
}

export async function cacheMenuFromServer(menu) {
  if (!Array.isArray(menu) || !menu.length) return;
  await saveMenu(menu);
  await setMeta("menu_cached_at", Date.now());
}

export async function prefetchMenu() {
  try {
    const { data } = await rawApi.get("/menu", { params: { active_only: true } });
    await cacheMenuFromServer(data);
  } catch {
    /* auth or network — cache fallback used on page load */
  }
}

export async function readCachedOrders() {
  return getAllOrders();
}

async function applyLocalPatch(orderId, mutator) {
  const orders = await readCachedOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;
  const draft = {
    ...order,
    items: (order.items || []).map((it) => ({ ...it })),
  };
  const next = mutator(draft);
  next.updated_at = new Date().toISOString();
  next._pending = true;
  await upsertOrder(next);
  return next;
}

export async function queueOrRun(config) {
  const method = (config.method || "get").toLowerCase();
  const online = isOnline() && (await pingBackend());

  if (method === "get") {
    if (!online) {
      if (config.url === "/orders" || config.url.startsWith("/orders?")) {
        return { data: await readCachedOrders(), fromCache: true };
      }
      if (config.url === "/menu" || config.url.startsWith("/menu?")) {
        const { getAllMenu } = await import("@/offline/db");
        return { data: await getAllMenu(), fromCache: true };
      }
    }
    try {
      const res = await rawApi.request(config);
      if (config.url === "/orders" || config.url.startsWith("/orders?")) {
        await cacheOrdersFromServer(Array.isArray(res.data) ? res.data : [res.data]);
      }
      if (config.url === "/menu" || config.url.startsWith("/menu?")) {
        await cacheMenuFromServer(res.data);
      }
      if (config.url?.match(/^\/orders\/[^/]+$/)) {
        await upsertOrder({ ...res.data, _offline: false, _pending: false });
      }
      return res;
    } catch (err) {
      if (config.url === "/menu" || config.url.startsWith("/menu?")) {
        const { getAllMenu } = await import("@/offline/db");
        const cached = await getAllMenu();
        if (cached.length) return { data: cached, fromCache: true };
      }
      throw err;
    }
  }

  const needsQueue = !online;

  if (needsQueue) {
    const entry = {
      id: makeLocalId(),
      method,
      url: config.url,
      data: config.data,
      created_at: Date.now(),
    };
    await enqueueMutation(entry);

    if (method === "post" && config.url === "/orders") {
      const localId = config.data?.client_id || makeLocalId();
      const order = await applyOptimisticOrder({ ...config.data, client_id: localId }, localId);
      notify();
      return { data: order, queued: true };
    }

    if (method === "patch" && config.url?.includes("/items/") && config.url?.endsWith("/status")) {
      const parts = config.url.split("/");
      const orderId = parts[2];
      const lineId = parts[4];
      const order = await applyLocalPatch(orderId, (o) => ({
        ...o,
        items: o.items.map((it) =>
          it.line_id === lineId ? { ...it, status: config.data.status } : it
        ),
      }));
      if (order) {
        await recordAndGossipOp({
          entity: "order",
          entityId: orderId,
          action: "item_status",
          payload: { line_id: lineId, status: config.data.status },
        });
      }
      notify();
      return { data: order, queued: true };
    }

    if (method === "patch" && config.url?.endsWith("/payment")) {
      const orderId = config.url.split("/")[2];
      const order = await applyLocalPatch(orderId, (o) => ({ ...o, ...config.data }));
      if (order) {
        await recordAndGossipOp({
          entity: "order",
          entityId: orderId,
          action: "payment",
          payload: { payment: config.data },
        });
      }
      notify();
      return { data: order, queued: true };
    }

    notify();
    return { data: { ok: true, queued: true }, queued: true };
  }

  const res = await rawApi.request(config);
  if (res.data?.id) {
    await upsertOrder({ ...res.data, _offline: false, _pending: false });
    const action = method === "post" ? "upsert" : "upsert";
    await recordAndGossipOp({
      entity: "order",
      entityId: res.data.id,
      action,
      payload: { order: res.data },
    });
  }
  return res;
}

async function flushOpsToCloud() {
  const { getAllMeshOps, getMeshMeta, setMeshMeta } = await import("@/offline/db");
  const ops = await getAllMeshOps();
  const lastSent = (await getMeshMeta("lastCloudLamport")) || 0;
  const pending = ops.filter((o) => o.lamport > lastSent);
  if (!pending.length) return;

  try {
    const { data } = await rawApi.post("/sync/ops", { ops: pending });
    if (data?.accepted?.length) {
      const maxLamport = Math.max(...pending.map((o) => o.lamport));
      await setMeshMeta("lastCloudLamport", maxLamport);
    }
  } catch { /* retry later */ }
}

export async function flushQueue() {
  if (syncing) return { synced: 0, failed: 0 };
  if (!isOnline() || !(await pingBackend())) return { synced: 0, failed: 0 };

  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    await flushOpsToCloud();
    const queue = await getQueue();
    for (const entry of queue) {
      try {
        const res = await rawApi.request({
          method: entry.method,
          url: entry.url,
          data: entry.data,
        });
        if (entry.method === "post" && entry.url === "/orders" && entry.data?.client_id) {
          const localId = entry.data.client_id;
          const orders = await readCachedOrders();
          const local = orders.find((o) => o.id === localId);
          if (local && res.data?.id) {
            await upsertOrder({ ...res.data, _offline: false, _pending: false });
            await recordAndGossipOp({
              entity: "order",
              entityId: localId,
              action: "id_remap",
              payload: { fromId: localId, toId: res.data.id, order_no: res.data.order_no },
            });
            await recordAndGossipOp({
              entity: "order",
              entityId: res.data.id,
              action: "upsert",
              payload: { order: res.data },
            });
          }
        } else if (res.data?.id) {
          await upsertOrder({ ...res.data, _offline: false, _pending: false });
        }
        await dequeueMutation(entry.id);
        synced += 1;
      } catch {
        failed += 1;
      }
    }
    if (synced > 0) {
      try {
        const { data } = await rawApi.get("/orders", { params: { limit: 200 } });
        await cacheOrdersFromServer(data);
      } catch { /* keep local */ }
    }
    const { getLamportClock } = await import("@/offline/db");
    const lamport = await getLamportClock();
    if (lamport > 500) await pruneMeshOps(lamport - 500);
  } finally {
    syncing = false;
    notify();
  }
  return { synced, failed };
}

async function pollDiscoveredPeers() {
  const found = await listDiscoveredPeers();
  for (const peer of found) {
    await connectToPeer(peer);
    await connectToDiscoveredPeer(peer);
  }
}

export async function startMesh(pin) {
  const meshPin = pin || (await fetchMeshPinFromCloud(rawApi));
  await startMeshTransport(meshPin);
  await startDiscovery(meshPin);
  meshStarted = true;
  setMeshTransportCallbacks({
    onApplied: () => notify(),
    onStatus: () => notify(),
  });
  if (!peerPollTimer) {
    peerPollTimer = setInterval(pollDiscoveredPeers, 5000);
  }
  pollDiscoveredPeers();
  notify();
}

export async function stopMesh() {
  meshStarted = false;
  if (peerPollTimer) {
    clearInterval(peerPollTimer);
    peerPollTimer = null;
  }
  await stopMeshTransport();
  await stopDiscovery();
  notify();
}

export async function forceResync() {
  await requestCatchUp();
  await flushQueue();
  notify();
}

let flushTimer = null;
export function startAutoSync(intervalMs = 12000) {
  if (flushTimer) return;
  const tick = async () => {
    await flushQueue();
  };
  tick();
  prefetchMenu();
  flushTimer = setInterval(tick, intervalMs);
  window.addEventListener("online", tick);
  window.addEventListener("online", prefetchMenu);

  fetchMeshPinFromCloud(rawApi).then((pin) => {
    startMesh(pin).catch(() => {});
  });

  onPeerChange(() => notify());
}

export async function pullCloudSnapshot() {
  if (!isOnline() || !(await pingBackend())) return;
  try {
    const { getLamportClock } = await import("@/offline/db");
    const since = await getLamportClock();
    const { data } = await rawApi.get("/sync/snapshot", { params: { since_lamport: since } });
    for (const op of data?.ops || []) {
      await ingestRemoteOp(op, op.deviceId, { skipGossip: true, skipPinCheck: true });
    }
    if (data?.orders?.length) await cacheOrdersFromServer(data.orders);
    notify();
  } catch { /* ignore */ }
}
