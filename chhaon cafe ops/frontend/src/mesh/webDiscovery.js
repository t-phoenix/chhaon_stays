import { WebPlugin } from "@capacitor/core";

export class WebDiscovery extends WebPlugin {
  async start() {
    console.info("[mesh] mDNS unavailable in browser — use QR join or install the cafe app");
  }

  async stop() {}

  async getPeers() {
    return { peers: [] };
  }
}
