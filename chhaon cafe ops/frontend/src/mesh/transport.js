import Peer from "simple-peer";
import {
  appendMeshOp,
  getAllMeshOps,
  getAllOrders,
  getMeshPeers,
  isOpApplied,
  markOpApplied,
  upsertMeshPeer,
} from "@/offline/db";
import { applyOpToOrder, buildOp, sortOps } from "./merge";
import { upsertOrder, deleteOrder } from "@/offline/db";
import { CafeMeshSignaling } from "./nativePlugins";
import { getOrCreateDeviceId, getDeviceName } from "./device";

const MAX_PEERS = 4;
const HEARTBEAT_MS = 15000;
const STALE_MS = 45000;
const GOSSIP_MS = 4000;

const peers = new Map();
let deviceId = "";
let deviceName = "";
let meshPin = "";
let onOpApplied = null;
let onStatusChange = null;
let gossipTimer = null;
let heartbeatTimer = null;
let started = false;

const ICE_CONFIG = { iceServers: [] };

export function setMeshTransportCallbacks({ onApplied, onStatus }) {
  onOpApplied = onApplied;
  onStatusChange = onStatus;
}

async function persistPeer(id, patch) {
  const existing = (await getMeshPeers()).find((p) => p.deviceId === id) || { deviceId: id };
  await upsertMeshPeer({ ...existing, ...patch, lastSeen: Date.now() });
  onStatusChange?.();
}

function sendToPeer(peerId, msg) {
  const entry = peers.get(peerId);
  if (entry?.peer?.connected) {
    try {
      entry.peer.send(JSON.stringify(msg));
    } catch { /* ignore */ }
  }
}

function broadcast(msg, exceptId) {
  for (const [id, entry] of peers) {
    if (id === exceptId) continue;
    if (entry.peer?.connected) sendToPeer(id, msg);
  }
}

async function handleMessage(fromId, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === "ping") {
    sendToPeer(fromId, { type: "pong", ts: Date.now() });
    await persistPeer(fromId, { connected: true });
    return;
  }

  if (msg.type === "pong") {
    await persistPeer(fromId, { connected: true, lastPong: Date.now() });
    return;
  }

  if (msg.type === "op" && msg.op) {
    await ingestRemoteOp(msg.op, fromId);
    sendToPeer(fromId, { type: "ack", opId: msg.op.opId });
    return;
  }

  if (msg.type === "snapshot_request") {
    const orders = await getAllOrders();
    const ops = await getAllMeshOps();
    const recent = ops.slice(-500);
    sendToPeer(fromId, {
      type: "snapshot_response",
      orders,
      ops: recent,
      lamport: recent.length ? recent[recent.length - 1].lamport : 0,
    });
    return;
  }

  if (msg.type === "snapshot_response") {
    for (const op of sortOps(msg.ops || [])) {
      await ingestRemoteOp(op, fromId, { skipGossip: true });
    }
    for (const order of msg.orders || []) {
      await upsertOrder({ ...order, _mesh: true });
    }
    onOpApplied?.();
    return;
  }

  if (msg.type === "ack") {
    return;
  }
}

export async function ingestRemoteOp(op, fromDeviceId, { skipGossip = false, skipPinCheck = false } = {}) {
  if (!op?.opId) return false;
  if (await isOpApplied(op.opId)) return false;
  if (!skipPinCheck && meshPin && op.meshPin && op.meshPin !== meshPin) return false;
  if (fromDeviceId && op.deviceId !== fromDeviceId) return false;

  await appendMeshOp(op);
  await markOpApplied(op.opId);

  const orders = await getAllOrders();
  const existing = orders.find((o) => o.id === op.entityId);
  const next = applyOpToOrder(existing, op);
  if (next === null) await deleteOrder(op.entityId);
  else await upsertOrder({ ...next, _mesh: true, _offline: true });

  if (!skipGossip) broadcast({ type: "op", op }, op.deviceId);
  onOpApplied?.();
  return true;
}

function createPeer(remoteId, initiator, remoteSignal) {
  if (peers.size >= MAX_PEERS && !peers.has(remoteId)) return null;

  const p = new Peer({
    initiator,
    trickle: true,
    config: ICE_CONFIG,
    channelConfig: { ordered: true },
  });

  const entry = { peer: p, remoteId, connected: false, lastPong: Date.now() };
  peers.set(remoteId, entry);

  p.on("signal", async (data) => {
    await CafeMeshSignaling.sendSignal({
      toDeviceId: remoteId,
      type: data.type === "offer" ? "offer" : data.type === "answer" ? "answer" : "ice",
      payload: JSON.stringify(data),
    });
  });

  p.on("connect", async () => {
    entry.connected = true;
    await persistPeer(remoteId, { connected: true, deviceName: remoteId });
    sendToPeer(remoteId, { type: "snapshot_request" });
    onStatusChange?.();
  });

  p.on("data", (data) => {
    handleMessage(remoteId, data.toString());
  });

  p.on("close", () => {
    peers.delete(remoteId);
    persistPeer(remoteId, { connected: false });
    onStatusChange?.();
  });

  p.on("error", () => {
    try { p.destroy(); } catch { /* ignore */ }
    peers.delete(remoteId);
    onStatusChange?.();
  });

  if (remoteSignal) {
    try {
      p.signal(JSON.parse(remoteSignal));
    } catch { /* ignore */ }
  }

  return p;
}

export async function handleSignalMessage(msg) {
  const { fromDeviceId, type, payload } = msg;
  if (!fromDeviceId || fromDeviceId === deviceId) return;

  let entry = peers.get(fromDeviceId);
  if (type === "offer") {
    if (!entry) createPeer(fromDeviceId, false, payload);
    else {
      try { entry.peer.signal(JSON.parse(payload)); } catch { /* ignore */ }
    }
    return;
  }

  if (!entry) {
    if (type === "answer" || type === "ice") {
      createPeer(fromDeviceId, true, null);
      entry = peers.get(fromDeviceId);
    }
  }
  if (entry && (type === "answer" || type === "ice")) {
    try { entry.peer.signal(JSON.parse(payload)); } catch { /* ignore */ }
  }
}

export async function connectToDiscoveredPeer(peer) {
  if (peer.deviceId === deviceId) return;
  if (peers.has(peer.deviceId)) return;
  createPeer(peer.deviceId, true, null);
  await CafeMeshSignaling.sendSignal({
    toDeviceId: peer.deviceId,
    type: "offer",
    payload: JSON.stringify({ type: "offer", deviceId }),
  });
}

export async function createOfferForQr() {
  return new Promise((resolve, reject) => {
    const tmpId = `qr_${Date.now()}`;
    const p = new Peer({ initiator: true, trickle: false, config: ICE_CONFIG });
    p.on("signal", (data) => {
      if (data.type === "offer") {
        resolve({ offerSdp: JSON.stringify(data), tmpPeer: p });
      }
    });
    p.on("error", reject);
    setTimeout(() => reject(new Error("offer timeout")), 8000);
  });
}

export async function completeQrAnswer(qrData, answerSdp) {
  const remoteId = qrData.deviceId;
  createPeer(remoteId, false, qrData.offerSdp);
  await CafeMeshSignaling.sendSignal({
    toDeviceId: remoteId,
    type: "answer",
    payload: answerSdp,
  });
}

export async function gossipOp(op) {
  const enriched = { ...op, meshPin };
  await appendMeshOp(enriched);
  await markOpApplied(op.opId);
  broadcast({ type: "op", op: enriched });
}

export async function requestCatchUp() {
  broadcast({ type: "snapshot_request" });
}

function startGossipLoop() {
  if (gossipTimer) return;
  gossipTimer = setInterval(async () => {
    const ops = await getAllMeshOps();
    const recent = ops.slice(-20);
    for (const op of recent) {
      broadcast({ type: "op", op });
    }
  }, GOSSIP_MS);
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of peers) {
      if (entry.peer?.connected) {
        sendToPeer(id, { type: "ping", ts: now });
        if (now - (entry.lastPong || 0) > STALE_MS) {
          try { entry.peer.destroy(); } catch { /* ignore */ }
          peers.delete(id);
        }
      }
    }
    onStatusChange?.();
  }, HEARTBEAT_MS);
}

export async function startMeshTransport(pin) {
  if (started) return;
  meshPin = pin || "";
  deviceId = await getOrCreateDeviceId();
  deviceName = await getDeviceName();
  window.__meshOnSignal = handleSignalMessage;
  window.__meshOnResume = requestCatchUp;
  startGossipLoop();
  startHeartbeat();
  started = true;
  onStatusChange?.();
}

export async function stopMeshTransport() {
  started = false;
  window.__meshOnSignal = null;
  window.__meshOnResume = null;
  if (gossipTimer) clearInterval(gossipTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  gossipTimer = null;
  heartbeatTimer = null;
  for (const [, entry] of peers) {
    try { entry.peer.destroy(); } catch { /* ignore */ }
  }
  peers.clear();
  onStatusChange?.();
}

export function getConnectedPeerCount() {
  let n = 0;
  for (const [, e] of peers) if (e.connected) n += 1;
  return n;
}

export function getTransportPeers() {
  return Array.from(peers.entries()).map(([id, e]) => ({
    deviceId: id,
    connected: e.connected,
  }));
}

export async function makeLocalOp({ entity, entityId, action, payload, lamport }) {
  const op = buildOp({
    deviceId,
    lamport,
    entity,
    entityId,
    action,
    payload,
  });
  op.meshPin = meshPin;
  return op;
}
