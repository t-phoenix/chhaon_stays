import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { ArrowLeft, Camera, QrCode } from "lucide-react";
import {
  buildQrPayload,
  parseQrPayload,
  getSignalInfo,
  fetchMeshPinFromCloud,
} from "@/mesh/discovery";
import { createOfferForQr, completeQrAnswer } from "@/mesh/transport";
import { getOrCreateDeviceId } from "@/mesh/device";
import api from "@/lib/api";

const MeshJoin = () => {
  const [tab, setTab] = useState("show");
  const [qrJson, setQrJson] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5Ref = useRef(null);

  useEffect(() => {
    (async () => {
      const pin = await fetchMeshPinFromCloud(api);
      const deviceId = await getOrCreateDeviceId();
      const signal = getSignalInfo();
      try {
        const { offerSdp } = await createOfferForQr();
        const payload = buildQrPayload({
          meshPin: pin,
          deviceId,
          offerSdp,
          signalHost: signal?.host || "0.0.0.0",
          signalPort: signal?.port,
        });
        setQrJson(JSON.stringify(payload));
      } catch {
        const payload = buildQrPayload({
          meshPin: pin,
          deviceId,
          offerSdp: "{}",
          signalHost: signal?.host || "0.0.0.0",
          signalPort: signal?.port,
        });
        setQrJson(JSON.stringify(payload));
      }
    })();
  }, []);

  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("mesh-qr-reader");
      html5Ref.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          const data = parseQrPayload(decoded);
          if (!data) {
            toast.error("Invalid or expired QR");
            return;
          }
          try {
            const answerPeer = await import("simple-peer").then((m) => m.default);
            const p = new answerPeer({ initiator: false, trickle: false, config: { iceServers: [] } });
            p.on("signal", async (sig) => {
              if (sig.type === "answer") {
                await completeQrAnswer(data, JSON.stringify(sig));
                toast.success("Joined mesh via QR");
                await scanner.stop();
                setScanning(false);
              }
            });
            p.signal(JSON.parse(data.offerSdp));
          } catch (e) {
            toast.error("QR handshake failed");
          }
        },
        () => {}
      );
    } catch {
      toast.error("Camera access required to scan QR");
      setScanning(false);
    }
  };

  const stopScan = async () => {
    if (html5Ref.current) {
      try {
        await html5Ref.current.stop();
      } catch { /* ignore */ }
      html5Ref.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { stopScan(); }, []);

  return (
    <div className="max-w-lg mx-auto space-y-6" data-testid="mesh-join-page">
      <div className="flex items-center gap-3">
        <Link to="/orders" className="p-2 rounded-xl border border-ink/10">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-2xl text-ink">Join mesh</h1>
      </div>

      <p className="text-sm text-ink2">
        Use when mDNS discovery fails (guest WiFi, iOS privacy). Host phone shows QR; other phone scans on the same hotspot.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => { setTab("show"); stopScan(); }}
          className={`flex-1 h-11 rounded-xl font-semibold text-sm ${tab === "show" ? "bg-ink text-white" : "bg-paper border border-ink/10"}`}
        >
          <QrCode className="w-4 h-4 inline mr-1" />
          Show my QR
        </button>
        <button
          onClick={() => setTab("scan")}
          className={`flex-1 h-11 rounded-xl font-semibold text-sm ${tab === "scan" ? "bg-ink text-white" : "bg-paper border border-ink/10"}`}
        >
          <Camera className="w-4 h-4 inline mr-1" />
          Scan QR
        </button>
      </div>

      {tab === "show" && qrJson && (
        <div className="card p-6 flex flex-col items-center gap-4">
          <QRCodeSVG value={qrJson} size={220} level="M" />
          <p className="text-xs text-ink2 text-center">Expires in 5 minutes · refresh by reopening this screen</p>
        </div>
      )}

      {tab === "scan" && (
        <div className="card p-4 space-y-4">
          <div id="mesh-qr-reader" ref={scannerRef} className="w-full min-h-[240px] rounded-xl overflow-hidden bg-ink/5" />
          {!scanning ? (
            <button onClick={startScan} className="btn-primary w-full" data-testid="start-qr-scan">
              Start camera
            </button>
          ) : (
            <button onClick={stopScan} className="btn-secondary w-full">
              Stop camera
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MeshJoin;
