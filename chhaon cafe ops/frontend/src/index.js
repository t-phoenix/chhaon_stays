import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

function removeEmergentBadge() {
  document.getElementById("emergent-badge")?.remove();
  document.querySelectorAll('a[href*="emergent.sh"], a[href*="emergentagent.com"]').forEach((link) => {
    const text = (link.textContent || "").toLowerCase();
    if (text.includes("emergent") || link.id === "emergent-badge") link.remove();
  });
}

removeEmergentBadge();
if (typeof MutationObserver !== "undefined") {
  new MutationObserver(removeEmergentBadge).observe(document.documentElement, { childList: true, subtree: true });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      // Drop stale workers from earlier deploys (v1/v2 cached index.html for assets).
      for (const reg of regs) {
        if (reg.active?.scriptURL?.includes("/sw.js")) {
          await reg.update();
        }
      }
      await navigator.serviceWorker.register("/sw.js");
    } catch {
      /* offline / private mode */
    }
  });
}
