import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, CloudUpload, Radio, Users } from "lucide-react";
import {
  flushQueue,
  forceResync,
  getMeshStatus,
  getPendingCount,
  isOnline,
  onSyncChange,
  pingBackend,
  pullCloudSnapshot,
} from "@/offline/sync";

const SyncStatusBanner = () => {
  const [online, setOnline] = useState(isOnline());
  const [reachable, setReachable] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [mesh, setMesh] = useState(getMeshStatus());

  const refresh = async () => {
    setOnline(isOnline());
    setPending(await getPendingCount());
    setReachable(await pingBackend());
    setMesh(getMeshStatus());
  };

  useEffect(() => {
    refresh();
    const unsub = onSyncChange(refresh);
    const onConn = () => refresh();
    window.addEventListener("online", onConn);
    window.addEventListener("offline", onConn);
    const t = setInterval(refresh, 12000);
    return () => {
      unsub();
      window.removeEventListener("online", onConn);
      window.removeEventListener("offline", onConn);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (online && reachable) pullCloudSnapshot();
  }, [online, reachable]);

  const syncNow = async () => {
    setSyncing(true);
    await forceResync();
    await flushQueue();
    await refresh();
    setSyncing(false);
  };

  const cloudOffline = !online || !reachable;
  const solo = mesh.active && mesh.peers === 0;
  const conflicts = 0;

  const shortTitle = () => {
    if (cloudOffline && solo) return "Offline · solo mode";
    if (cloudOffline && mesh.peers > 0) return `Offline · mesh (${mesh.peers})`;
    if (cloudOffline) return "Offline · saves on device";
    if (solo) return "Solo · no mesh peers";
    if (mesh.peers > 0) return `Mesh · ${mesh.peers} peer${mesh.peers !== 1 ? "s" : ""}`;
    return "Back online";
  };

  const longTitle = () => {
    if (cloudOffline && solo) return "Solo mode — no mesh peers nearby. Orders save on this device.";
    if (cloudOffline && mesh.peers > 0) return `Mesh active (${mesh.peers} peers) — cloud offline`;
    if (cloudOffline) return "Working offline — orders save on this device and sync when the network returns.";
    if (solo) return "Cloud online — solo mesh (no peers on LAN). Join mesh from the QR icon in the header.";
    if (mesh.peers > 0) return `Mesh active · ${mesh.peers} peer${mesh.peers !== 1 ? "s" : ""}`;
    return "Back online";
  };

  if (!cloudOffline && pending === 0 && !solo && mesh.peers > 0 && conflicts === 0) {
    return (
      <div className="mb-2 md:mb-4 rounded-xl md:rounded-2xl border px-3 py-1.5 md:px-4 md:py-2 flex items-center gap-2 bg-[#F2F7F1] border-[#7B9E73]/40" data-testid="sync-banner-ok">
        <Radio className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#7B9E73]" />
        <span className="text-xs md:text-sm text-ink2">Mesh active · {mesh.peers} peer{mesh.peers !== 1 ? "s" : ""} · synced</span>
      </div>
    );
  }

  const showSyncAction = cloudOffline || pending > 0 || solo;

  return (
    <div
      className={`mb-2 md:mb-4 rounded-xl md:rounded-2xl border px-3 py-2 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 ${
        cloudOffline ? "bg-[#FEF5EC] border-[#E6A15C]/40" : "bg-[#F2F7F1] border-[#7B9E73]/40"
      }`}
      data-testid="sync-status-banner"
    >
      {cloudOffline ? (
        <WifiOff className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-[#E6A15C]" />
      ) : (
        <Wifi className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-[#7B9E73]" />
      )}
      <div className="text-xs md:text-sm font-semibold text-ink min-w-0 flex-1 leading-snug">
        <span className="md:hidden">{shortTitle()}</span>
        <span className="hidden md:inline">{longTitle()}</span>
        {pending > 0 && (
          <span className="text-ink2 font-normal">
            {" "}
            · {pending} pending
          </span>
        )}
        {mesh.peers > 0 && (
          <span className="inline-flex items-center gap-1 ml-1 md:ml-2 text-ink2 font-normal">
            <Users className="w-3 h-3 md:w-3.5 md:h-3.5" /> {mesh.peers}
          </span>
        )}
      </div>
      {showSyncAction && (
        <button
          onClick={syncNow}
          disabled={syncing}
          className="inline-flex items-center justify-center gap-1.5 h-9 md:h-10 px-2.5 md:px-4 rounded-xl bg-ink text-white text-sm font-semibold btn-tactile disabled:opacity-50 shrink-0"
          data-testid="sync-now-button"
          aria-label={syncing ? "Syncing" : "Sync now"}
        >
          {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync now"}</span>
        </button>
      )}
    </div>
  );
};

export default SyncStatusBanner;
