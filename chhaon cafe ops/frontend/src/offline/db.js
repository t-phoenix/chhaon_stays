const DB_NAME = "chhaon-cafe-ops";
const DB_VERSION = 2;

const STORES = {
  orders: "orders",
  menu: "menu",
  queue: "sync_queue",
  meta: "meta",
  mesh_ops: "mesh_ops",
  mesh_peers: "mesh_peers",
  mesh_meta: "mesh_meta",
  applied_ops: "applied_ops",
};

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.orders)) {
        db.createObjectStore(STORES.orders, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.menu)) {
        db.createObjectStore(STORES.menu, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.queue)) {
        const q = db.createObjectStore(STORES.queue, { keyPath: "id" });
        q.createIndex("created_at", "created_at");
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.mesh_ops)) {
        const ops = db.createObjectStore(STORES.mesh_ops, { keyPath: "opId" });
        ops.createIndex("lamport", "lamport");
        ops.createIndex("entityId", "entityId");
        ops.createIndex("ts", "ts");
      }
      if (!db.objectStoreNames.contains(STORES.mesh_peers)) {
        db.createObjectStore(STORES.mesh_peers, { keyPath: "deviceId" });
      }
      if (!db.objectStoreNames.contains(STORES.mesh_meta)) {
        db.createObjectStore(STORES.mesh_meta, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.applied_ops)) {
        db.createObjectStore(STORES.applied_ops, { keyPath: "opId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const os = transaction.objectStore(store);
    const result = fn(os);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function txMulti(stores, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    const result = fn(transaction);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveOrders(orders) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES.orders, "readwrite");
    const os = t.objectStore(STORES.orders);
    for (const o of orders) os.put(o);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function upsertOrder(order) {
  return tx(STORES.orders, "readwrite", (os) => os.put(order));
}

export async function deleteOrder(id) {
  return tx(STORES.orders, "readwrite", (os) => os.delete(id));
}

export async function getOrder(id) {
  return tx(STORES.orders, "readonly", (os) => os.get(id));
}

export async function getAllOrders() {
  return tx(STORES.orders, "readonly", (os) => {
    const req = os.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function saveMenu(items) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES.menu, "readwrite");
    const os = t.objectStore(STORES.menu);
    os.clear();
    for (const m of items) os.put(m);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getAllMenu() {
  return tx(STORES.menu, "readonly", (os) => {
    const req = os.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function enqueueMutation(entry) {
  return tx(STORES.queue, "readwrite", (os) => os.put(entry));
}

export async function getQueue() {
  return tx(STORES.queue, "readonly", (os) => {
    const req = os.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => a.created_at - b.created_at);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function dequeueMutation(id) {
  return tx(STORES.queue, "readwrite", (os) => os.delete(id));
}

export async function setMeta(key, value) {
  return tx(STORES.meta, "readwrite", (os) => os.put({ key, value }));
}

export async function getMeta(key) {
  const row = await tx(STORES.meta, "readonly", (os) => os.get(key));
  return row?.value;
}

// --- Mesh stores ---

export async function appendMeshOp(op) {
  return tx(STORES.mesh_ops, "readwrite", (os) => os.put(op));
}

export async function getMeshOps({ sinceLamport = 0, limit = 500 } = {}) {
  return tx(STORES.mesh_ops, "readonly", (os) => {
    const idx = os.index("lamport");
    const range = IDBKeyRange.lowerBound(sinceLamport, true);
    const req = idx.getAll(range, limit);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => a.lamport - b.lamport);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getAllMeshOps() {
  return tx(STORES.mesh_ops, "readonly", (os) => {
    const req = os.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => a.lamport - b.lamport);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function pruneMeshOps(beforeLamport) {
  const ops = await getAllMeshOps();
  const toDelete = ops.filter((o) => o.lamport < beforeLamport);
  if (!toDelete.length) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES.mesh_ops, "readwrite");
    const os = t.objectStore(STORES.mesh_ops);
    for (const o of toDelete) os.delete(o.opId);
    t.oncomplete = () => resolve(toDelete.length);
    t.onerror = () => reject(t.error);
  });
}

export async function upsertMeshPeer(peer) {
  return tx(STORES.mesh_peers, "readwrite", (os) => os.put(peer));
}

export async function getMeshPeers() {
  return tx(STORES.mesh_peers, "readonly", (os) => {
    const req = os.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function removeMeshPeer(deviceId) {
  return tx(STORES.mesh_peers, "readwrite", (os) => os.delete(deviceId));
}

export async function setMeshMeta(key, value) {
  return tx(STORES.mesh_meta, "readwrite", (os) => os.put({ key, value }));
}

export async function getMeshMeta(key) {
  const row = await tx(STORES.mesh_meta, "readonly", (os) => os.get(key));
  return row?.value;
}

export async function isOpApplied(opId) {
  const row = await tx(STORES.applied_ops, "readonly", (os) => os.get(opId));
  return Boolean(row);
}

export async function markOpApplied(opId) {
  return tx(STORES.applied_ops, "readwrite", (os) => os.put({ opId, at: Date.now() }));
}

export async function getLamportClock() {
  const v = await getMeshMeta("lamportClock");
  return typeof v === "number" ? v : 0;
}

export async function setLamportClock(n) {
  return setMeshMeta("lamportClock", n);
}

export async function bumpLamport() {
  const cur = await getLamportClock();
  const next = cur + 1;
  await setLamportClock(next);
  return next;
}

export async function advanceLamport(received) {
  const cur = await getLamportClock();
  const next = Math.max(cur, received) + 1;
  await setLamportClock(next);
  return next;
}

export function makeLocalId() {
  return `local_${crypto.randomUUID()}`;
}

export function makeOpId() {
  return crypto.randomUUID();
}
