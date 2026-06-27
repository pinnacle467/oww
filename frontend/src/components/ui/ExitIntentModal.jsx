import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { CTAButton } from "@/components/ui/CTAButton";

const SEEN_KEY = "oww_exit_seen";

export function ExitIntentModal() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [message, setMessage] = useState("");

  const disabled = location.pathname.startsWith("/admin") || location.pathname === "/contact";

  const trigger = useCallback(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return;
    sessionStorage.setItem(SEEN_KEY, "1");
    setOpen(true);
  }, []);

  useEffect(() => {
    if (disabled) return;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    let timer;
    const onMouseOut = (e) => {
      if (e.clientY <= 0) trigger();
    };
    if (isMobile) {
      timer = setTimeout(trigger, 60000);
    } else {
      document.addEventListener("mouseout", onMouseOut);
    }
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [disabled, trigger]);

  if (!open || disabled) return null;

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const { data } = await api.post("/leads", { email, source: "exit_intent" });
      setMessage(data.message);
      setStatus("done");
    } catch (err) {
      setMessage(formatApiError(err.response?.data?.detail) || "Please try again.");
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-nature-deep/60 backdrop-blur-sm"
      data-testid="exit-intent-overlay"
      onClick={() => setOpen(false)}
    >
      <GlassCard
        variant="solid"
        className="relative w-full max-w-md p-9 sm:p-11 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
        data-testid="exit-intent-modal"
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 text-ink-soft hover:text-ink transition-colors"
          aria-label="Close"
          data-testid="exit-intent-close"
        >
          <X className="h-5 w-5" />
        </button>
        {status === "done" ? (
          <div className="text-center py-6">
            <p className="font-display text-3xl text-nature-deep mb-3">Wonderful.</p>
            <p className="text-ink-soft editorial">{message}</p>
          </div>
        ) : (
          <>
            <p className="label-eyebrow text-nature-mid mb-4">Before you go</p>
            <h3 className="font-display text-3xl sm:text-4xl font-light text-ink leading-tight mb-3">
              The wild is calling.
            </h3>
            <p className="text-ink-soft editorial mb-6">
              Leave your email and we will send word of upcoming journeys, quiet retreats and the occasional note from the road.
            </p>
            <form onSubmit={submit} className="space-y-4" data-testid="exit-intent-form">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-transparent border-b border-ink/30 py-3 font-body text-ink placeholder:text-ink-soft/60 focus:border-nature-mid outline-none transition-colors"
                data-testid="exit-intent-email"
              />
              {status === "error" && <p className="text-destructive text-sm">{message}</p>}
              <CTAButton type="submit" variant="filled" className="w-full" disabled={status === "sending"} data-testid="exit-intent-submit">
                {status === "sending" ? "Sending" : "Keep me in the loop"}
              </CTAButton>
            </form>
          </>
        )}
      </GlassCard>
    </div>
  );
}

export default ExitIntentModal;
