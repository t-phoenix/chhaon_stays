import { WebPlugin } from "@capacitor/core";
import type { CafeMeshDiscoveryPlugin, DiscoveryPeer, StartOptions } from "./definitions";

export class CafeMeshDiscoveryWeb extends WebPlugin implements CafeMeshDiscoveryPlugin {
  async start(_options: StartOptions): Promise<void> {
    console.info("[CafeMeshDiscovery] mDNS unavailable on web — use QR join");
  }

  async stop(): Promise<void> {}

  async getPeers(): Promise<{ peers: DiscoveryPeer[] }> {
    return { peers: [] };
  }
}
