export interface SignalMessage {
  fromDeviceId: string;
  toDeviceId: string;
  type: "offer" | "answer" | "ice";
  payload: string;
}

export interface ServerInfo {
  host: string;
  port: number;
}

export interface CafeMeshSignalingPlugin {
  startServer(options: { port?: number; deviceId: string }): Promise<ServerInfo>;
  stopServer(): Promise<void>;
  connect(options: { host: string; port: number; deviceId: string }): Promise<void>;
  disconnect(): Promise<void>;
  sendSignal(options: { toDeviceId: string; type: string; payload: string }): Promise<void>;
}
