// Shared resolver for the API base URL. Centralised here so the whole
// frontend has ONE place that decides "which host do I talk to" — and so
// the build is resilient to a stale REACT_APP_BACKEND_URL baked into the
// production bundle.
//
// Why the resilience matters:
//   1. The CRA `.env` REACT_APP_BACKEND_URL is replaced AT BUILD TIME by
//      webpack — once the bundle is on a CDN, the value is frozen.
//   2. Emergent preview environments expose the same backend cluster under
//      multiple hostnames (e.g. `handover-flow-1.preview.emergentagent.com`
//      AND `470a933d-...preview.emergentagent.com`). When the bundled value
//      is one host and the user's tab is on the OTHER host, the auth POST
//      becomes a cross-origin call. Strict browsers / Safari / Brave / 3rd-
//      party-cookie blockers can refuse it, manifesting as "Sign in does
//      nothing" — which is exactly the bug Adele reported.
//   3. The Kubernetes ingress in front of the preview / live cluster routes
//      `/api/*` to the FastAPI backend regardless of host, so a relative
//      same-origin call always works.
//
// Behaviour:
//   - If `REACT_APP_BACKEND_URL` is unset (or empty), return "" — calls
//     resolve to the current origin, ingress handles `/api/*`.
//   - If the env URL's host matches `window.location.host`, return the env
//     URL — back-compat for builds that explicitly expect that origin.
//   - If the env URL's host DIFFERS from the page's host, fall back to ""
//     (same origin) so the auth POST stays on the same hostname the user
//     loaded the page from. No more cross-origin failures.
//
// This is browser-only code; on SSR / Node contexts (none for this CRA
// app, but defensive anyway) it returns the raw env URL.

const ENV_URL = process.env.REACT_APP_BACKEND_URL || "";

export function resolveBackendUrl() {
  if (typeof window === "undefined") return ENV_URL;
  if (!ENV_URL) return "";
  try {
    const envHost = new URL(ENV_URL).host;
    if (!envHost) return "";
    if (envHost === window.location.host) return ENV_URL;
    // Host mismatch — fall back to same origin to dodge cross-origin
    // failures. The browser will request relative `/api/...` which the
    // ingress on the current host routes to the backend cluster.
    return "";
  } catch {
    return "";
  }
}

export const BACKEND_URL = resolveBackendUrl();
