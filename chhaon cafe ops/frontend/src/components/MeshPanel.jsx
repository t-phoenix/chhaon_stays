import { useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Radio, RefreshCw, Smartphone, KeyRound, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { forceResync, getMeshStatus, onSyncChange, startMesh, stopMesh } from "@/offline/sync";
import { getMeshPeers } from "@/offline/db";
import { getOrCreateDeviceId, getDeviceName, setDeviceName } from "@/mesh/device";
import { listDiscoveredPeers, getSignalInfo } from "@/mesh/discovery";
import { getTransportPeers } from "@/mesh/transport";

const MeshPanel = () => {
  const [meshPin, setMeshPin] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceNameState] = useState("");
  const [status, setStatus] = useState(getMeshStatus());
  const [peers, setPeers] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(getMeshStatus());
    setPeers(await getMeshPeers());
    setDiscovered(await listDiscoveredPeers());
    setDeviceId(await getOrCreateDeviceId());
    setDeviceNameState(await getDeviceName());
  }, []);

  useEffect(() => {
    refresh();
    api.get("/auth/mesh-pin").then((r) => setMeshPin(r.data?.pin || "")).catch(() => {});
    const unsub = onSyncChange(refresh);
    return unsub;
  }, [refresh]);

  const savePin = async () => {
    if (meshPin.length < 4) return toast.error("PIN must be at least 4 characters");
    setBusy(true);
    try {
      await api.patch("/auth/mesh-pin", { pin: meshPin });
      toast.success("Mesh PIN updated for today");
      await startMesh(meshPin);
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    await setDeviceName(deviceName);
    toast.success("Device name saved");
  };

  const restartMesh = async () => {
    setBusy(true);
    try {
      await stopMesh();
      await startMesh(meshPin);
      toast.success("Mesh restarted");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const fullResync = async () => {
    setBusy(true);
    await forceResync();
    toast.success("Full resync triggered");
    await refresh();
    setBusy(false);
  };

  const signal = getSignalInfo();
  const connected = getTransportPeers().filter((p) => p.connected);

  return (
    <div className="card p-5 space-y-5" data-testid="mesh-panel">
      <div className="flex items-center gap-2">
        <Radio className="w-5 h-5 text-sage" />
        <h2 className="font-display text-xl text-ink">Phone mesh sync</h2>
      </div>
      <p className="text-sm text-ink2">
        Staff phones on the same WiFi hotspot share orders instantly — no internet required. Install the Capacitor app for mDNS discovery; use QR join as fallback.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-ink2 uppercase tracking-wide">Daily mesh PIN</label>
          <div className="flex gap-2 mt-1">
            <input
              value={meshPin}
              onChange={(e) => setMeshPin(e.target.value)}
              className="input flex-1"
              placeholder="e.g. cafe14"
              data-testid="mesh-pin-input"
            />
            <button onClick={savePin} disabled={busy} className="btn-primary shrink-0" data-testid="mesh-pin-save">
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink2 uppercase tracking-wide">This device</label>
          <div className="flex gap-2 mt-1">
            <input
              value={deviceName}
              onChange={(e) => setDeviceNameState(e.target.value)}
              className="input flex-1"
              data-testid="device-name-input"
            />
            <button onClick={saveName} className="btn-secondary shrink-0">
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-ink2 mt-1 truncate">ID: {deviceId}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`chip ${status.active ? "bg-[#F2F7F1] text-[#7B9E73]" : "bg-[#F5F6F5] text-ink2"}`}>
          {status.active ? "Mesh running" : "Mesh stopped"}
        </span>
        <span className="chip bg-paper text-ink2">{connected.length} connected</span>
        <span className="chip bg-paper text-ink2">{discovered.length} discovered</span>
        {signal && <span className="chip bg-paper text-ink2">Signal {signal.host}:{signal.port}</span>}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Connected peers</h3>
        {connected.length === 0 && <p className="text-sm text-ink2">No active peer connections. Ensure phones share a hotspot (not guest WiFi).</p>}
        <ul className="space-y-1">
          {connected.map((p) => (
            <li key={p.deviceId} className="text-sm text-ink flex justify-between">
              <span>{peers.find((x) => x.deviceId === p.deviceId)?.deviceName || p.deviceId}</span>
              <span className="text-sage">live</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/mesh/join" className="btn-secondary inline-flex items-center gap-2" data-testid="mesh-join-panel-link">
          <QrCode className="w-4 h-4" />
          Join via QR
        </Link>
        <button onClick={restartMesh} disabled={busy} className="btn-secondary" data-testid="mesh-restart">
          Restart mesh
        </button>
        <button onClick={fullResync} disabled={busy} className="btn-primary" data-testid="mesh-resync">
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
          Force full resync
        </button>
      </div>
    </div>
  );
};

export default MeshPanel;
