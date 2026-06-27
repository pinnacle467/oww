import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Minimal, accessible cookie banner. Sits above the StickyCTA so it doesn't get hidden.
// Decision persisted in localStorage under `oww:cookies`.
// Values: "accepted" | "declined". Banner only shows when key is unset.
export const COOKIE_KEY = "oww:cookies";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(COOKIE_KEY)) {
        // Tiny delay so the banner doesn't flash on first paint.
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch (e) {
      // localStorage blocked, show banner anyway.
      setVisible(true);
    }
    return undefined;
  }, []);

  const decide = (choice) => {
    try { window.localStorage.setItem(COOKIE_KEY, choice); } catch (e) { /* ignore */ }
    setVisible(false);
    // Let listeners (e.g. analytics bootstrap) react without a reload.
    try { window.dispatchEvent(new CustomEvent("oww:cookie-decision", { detail: choice })); } catch (e) { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div className="mx-auto max-w-5xl bg-nature-deep text-cream rounded-md shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-display text-base sm:text-lg leading-snug">
              We use a few essential cookies.
            </p>
            <p className="editorial text-cream/75 text-sm leading-relaxed mt-1">
              They help the site run smoothly and let us understand which journeys you love most. Read our{" "}
              <Link to="/cookies" className="underline underline-offset-2 hover:text-gold transition-colors" data-testid="cookie-policy-link">
                cookies policy
              </Link>
              .
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => decide("declined")}
              className="font-accent text-[11px] uppercase tracking-label px-4 py-2.5 rounded-sm border border-cream/30 text-cream/85 hover:text-cream hover:border-cream/60 transition-colors"
              data-testid="cookie-decline"
            >
              Decline
            </button>
            <button
              onClick={() => decide("accepted")}
              className="font-accent text-[11px] uppercase tracking-label px-5 py-2.5 rounded-sm bg-gold text-nature-deep hover:bg-gold/90 transition-colors"
              data-testid="cookie-accept"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;
