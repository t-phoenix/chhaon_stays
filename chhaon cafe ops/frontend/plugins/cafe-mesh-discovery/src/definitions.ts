export interface DiscoveryPeer {
  deviceId: string;
  deviceName: string;
  host: string;
  port: number;
  signalPort?: number;
}

export interface StartOptions {
  serviceName: string;
  deviceId: string;
  deviceName: string;
  signalPort?: number;
  txtRecord?: Record<string, string>;
}

export interface CafeMeshDiscoveryPlugin {
  start(options: StartOptions): Promise<void>;
  stop(): Promise<void>;
  getPeers(): Promise<{ peers: DiscoveryPeer[] }>;
}
