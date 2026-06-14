import { flushQueue, onSyncChange, pingBackend, queueOrRun, startAutoSync, getMeshStatus, forceResync } from "./sync";

export { onSyncChange, flushQueue, pingBackend, startAutoSync, getMeshStatus, forceResync };

function formatDetail(err) {
  const d = err?.response?.data?.detail;
  if (!d) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (typeof d === "object" && d?.msg) return d.msg;
  return String(d);
}

const offlineApi = {
  get: (url, config = {}) => queueOrRun({ ...config, method: "get", url, params: config.params }),
  post: (url, data, config = {}) => queueOrRun({ ...config, method: "post", url, data }),
  patch: (url, data, config = {}) => queueOrRun({ ...config, method: "patch", url, data }),
  delete: (url, config = {}) => queueOrRun({ ...config, method: "delete", url }),
};

export function formatApiError(err) {
  if (err?.queued) return "Saved offline — will sync when connected";
  return formatDetail(err);
}

export default offlineApi;
