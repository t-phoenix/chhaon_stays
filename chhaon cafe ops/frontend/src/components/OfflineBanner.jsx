import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { flushQueue, getPendingCount, isOnline, onSyncChange, pingBackend } from "@/offline/sync";

const OfflineBanner = () => {
  const [online, setOnline] = useState(isOnline());
  const [reachable, setReachable] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    setOnline(isOnline());
    setPending(await getPendingCount());
    setReachable(await pingBackend());
  };

  useEffect(() => {
    refresh();
    const unsub = onSyncChange(refresh);
    const onConn = () => refresh();
    window.addEventListener("online", onConn);
    window.addEventListener("offline", onConn);
    const t = setInterval(refresh, 15000);
    return () => {
      unsub();
      window.removeEventListener("online", onConn);
      window.removeEventListener("offline", onConn);
      clearInterval(t);
    };
  }, []);

  const syncNow = async () => {
    setSyncing(true);
    await flushQueue();
    await refresh();
    setSyncing(false);
  };

  const offline = !online || !reachable;
  if (!offline && pending === 0) return null;

  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        offline ? "bg-[#FEF5EC] border-[#E6A15C]/40" : "bg-[#F2F7F1] border-[#7B9E73]/40"
      }`}
      data-testid="offline-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        {offline ? <WifiOff className="w-4 h-4 shrink-0 text-[#E6A15C]" /> : <Wifi className="w-4 h-4 shrink-0 text-[#7B9E73]" />}
        <div className="text-sm font-semibold text-ink">
          {offline
            ? "Working offline — orders save on this device and sync when the network returns."
            : "Back online"}
          {pending > 0 && <span className="text-ink2 font-normal"> · {pending} change{pending > 1 ? "s" : ""} waiting to sync</span>}
        </div>
      </div>
      <button
        onClick={syncNow}
        disabled={syncing || offline}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-ink text-white text-sm font-semibold btn-tactile disabled:opacity-50 shrink-0 sm:ml-auto"
        data-testid="sync-now-button"
      >
        {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
};

export default OfflineBanner;
