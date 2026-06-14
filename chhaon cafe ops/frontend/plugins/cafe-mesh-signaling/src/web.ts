import { WebPlugin } from "@capacitor/core";
import type { CafeMeshSignalingPlugin, ServerInfo } from "./definitions";

type Handler = (msg: { fromDeviceId: string; toDeviceId: string; type: string; payload: string }) => void;

/** Browser fallback: in-memory hub for same-tab dev; real LAN needs native plugin or manual WS host */
const hubs = new Map();

export class CafeMeshSignalingWeb extends WebPlugin implements CafeMeshSignalingPlugin {
  ws = null;
  deviceId = "";
  serverPort = 0;
  handlers = new Set();

  async startServer(options) {
    this.deviceId = options.deviceId;
    this.serverPort = options.port || 8765;
    if (!hubs.has(this.serverPort)) hubs.set(this.serverPort, new Set());
    hubs.get(this.serverPort).add(this);
    this.notifyListeners("serverReady", { host: "127.0.0.1", port: this.serverPort });
    return { host: "127.0.0.1", port: this.serverPort };
  }

  async stopServer() {
    const set = hubs.get(this.serverPort);
    if (set) set.delete(this);
    await this.disconnect();
  }

  async connect(options) {
    this.deviceId = options.deviceId;
    try {
      this.ws = new WebSocket(`ws://${options.host}:${options.port}/mesh`);
      this.ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.toDeviceId === this.deviceId || data.toDeviceId === "*") {
            this.notifyListeners("signal", data);
          }
        } catch { /* ignore */ }
      };
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ type: "hello", deviceId: this.deviceId }));
      };
    } catch {
      // Native plugin required for cross-device LAN signaling in production
    }
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async sendSignal(options) {
    const msg = {
      fromDeviceId: this.deviceId,
      toDeviceId: options.toDeviceId,
      type: options.type,
      payload: options.payload,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    const set = hubs.get(this.serverPort);
    if (set) {
      for (const peer of set) {
        if (peer.deviceId !== this.deviceId) {
          peer.notifyListeners("signal", msg);
        }
      }
    }
  }
}
