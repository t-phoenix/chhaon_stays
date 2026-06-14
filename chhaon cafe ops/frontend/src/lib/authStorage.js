/** Persist JWT for cross-origin deploys (Vercel frontend → Render API) where httpOnly cookies are blocked. */
const STORAGE_KEY = "chhaon_access";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // match backend COOKIE_MAX_AGE

export function saveAccessToken(token) {
  if (!token) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token, savedAt: Date.now() }),
  );
}

export function getAccessToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, savedAt } = JSON.parse(raw);
    if (!token || Date.now() - (savedAt || 0) > MAX_AGE_MS) {
      clearAccessToken();
      return null;
    }
    return token;
  } catch {
    clearAccessToken();
    return null;
  }
}

export function clearAccessToken() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Attach Bearer token to axios requests (cookie still used when same-origin). */
export function attachAuthInterceptor(client) {
  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}
