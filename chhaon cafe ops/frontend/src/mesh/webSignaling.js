import { WebPlugin } from "@capacitor/core";

const hubs = new Map();

export class WebSignaling extends WebPlugin {
  ws = null;
  deviceId = "";
  serverPort = 8765;

  async startServer(options = {}) {
    this.deviceId = options.deviceId;
    this.serverPort = options.port || 8765;
    if (!hubs.has(this.serverPort)) hubs.set(this.serverPort, new Set());
    hubs.get(this.serverPort).add(this);
    const info = { host: "127.0.0.1", port: this.serverPort };
    await this.notifyListeners("serverReady", info);
    return info;
  }

  async stopServer() {
    const set = hubs.get(this.serverPort);
    if (set) set.delete(this);
    await this.disconnect();
  }

  async connect(options) {
    this.deviceId = options.deviceId;
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(`ws://${options.host}:${options.port}/mesh`);
        this.ws.onopen = () => {
          this.ws.send(JSON.stringify({ type: "hello", deviceId: this.deviceId }));
          resolve();
        };
        this.ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.toDeviceId === this.deviceId || data.toDeviceId === "*") {
              this.notifyListeners("signal", data);
            }
          } catch { /* ignore */ }
        };
        this.ws.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
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
    if (this.ws?.readyState === WebSocket.OPEN) {
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
