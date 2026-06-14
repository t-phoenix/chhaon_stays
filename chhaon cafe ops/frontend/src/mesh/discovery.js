import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { CafeMeshDiscovery, CafeMeshSignaling } from "./nativePlugins";
import { getOrCreateDeviceId, getDeviceName } from "./device";

const DEFAULT_SIGNAL_PORT = 8765;

let running = false;
let meshPin = "";
let signalInfo = null;
let discoveryListener = null;
let signalListener = null;
const peerCallbacks = new Set();

export function onPeerChange(fn) {
  peerCallbacks.add(fn);
  return () => peerCallbacks.delete(fn);
}

function notifyPeers() {
  peerCallbacks.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

export async function getMeshPin() {
  return meshPin;
}

export async function setMeshPin(pin) {
  meshPin = String(pin || "").trim();
}

export function getSignalInfo() {
  return signalInfo;
}

export async function startDiscovery(pin) {
  if (running) return;
  meshPin = pin || meshPin;
  const deviceId = await getOrCreateDeviceId();
  const deviceName = await getDeviceName();
  const serviceName = meshPin ? `chhaon-${meshPin}` : "chhaon-ops";

  signalInfo = await CafeMeshSignaling.startServer({
    port: DEFAULT_SIGNAL_PORT,
    deviceId,
  });

  await CafeMeshDiscovery.start({
    serviceName,
    deviceId,
    deviceName,
    signalPort: signalInfo?.port || DEFAULT_SIGNAL_PORT,
  });

  if (signalListener) await signalListener.remove();
  signalListener = await CafeMeshSignaling.addListener("signal", (msg) => {
    if (window.__meshOnSignal) window.__meshOnSignal(msg);
  });

  if (discoveryListener) await discoveryListener.remove();
  discoveryListener = await CafeMeshDiscovery.addListener("peerFound", () => notifyPeers());
  const lostListener = await CafeMeshDiscovery.addListener("peerLost", () => notifyPeers());

  if (Capacitor.isNativePlatform()) {
    App.addListener("appStateChange", async ({ isActive }) => {
      if (isActive && window.__meshOnResume) {
        await window.__meshOnResume();
      }
    });
  }

  running = true;
  discoveryListener._lost = lostListener;
  notifyPeers();
}

export async function stopDiscovery() {
  if (!running) return;
  running = false;
  try {
    await CafeMeshDiscovery.stop();
    await CafeMeshSignaling.stopServer();
    await CafeMeshSignaling.disconnect();
  } catch { /* ignore */ }
  if (discoveryListener) {
    await discoveryListener.remove();
    if (discoveryListener._lost) await discoveryListener._lost.remove();
    discoveryListener = null;
  }
  if (signalListener) {
    await signalListener.remove();
    signalListener = null;
  }
  signalInfo = null;
  notifyPeers();
}

export async function listDiscoveredPeers() {
  try {
    const { peers } = await CafeMeshDiscovery.getPeers();
    return peers || [];
  } catch {
    return [];
  }
}

export async function connectToPeer(peer) {
  const deviceId = await getOrCreateDeviceId();
  await CafeMeshSignaling.connect({
    host: peer.host,
    port: peer.signalPort || peer.port || DEFAULT_SIGNAL_PORT,
    deviceId,
  });
}

export function buildQrPayload({ meshPin: pin, deviceId, offerSdp, signalHost, signalPort }) {
  return {
    v: 1,
    meshPin: pin,
    deviceId,
    offerSdp,
    signalHost,
    signalPort: signalPort || DEFAULT_SIGNAL_PORT,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
}

export function parseQrPayload(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data?.deviceId || !data?.offerSdp) return null;
    if (data.expiresAt && Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function isDiscoveryRunning() {
  return running;
}

export async function fetchMeshPinFromCloud(api) {
  try {
    const { data } = await api.get("/auth/mesh-pin");
    if (data?.pin) {
      meshPin = data.pin;
      return data.pin;
    }
  } catch { /* cloud only */ }
  return meshPin;
}
