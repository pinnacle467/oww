import { Link, useLocation } from "react-router-dom";
import { Phone } from "lucide-react";

export function StickyCTA() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin") || location.pathname === "/contact") return null;
  return (
    <Link
      to="/contact"
      className="fixed bottom-5 right-5 z-[90] lg:hidden glass-dark rounded-full pl-4 pr-5 py-3 flex items-center gap-2 text-cream shadow-xl"
      style={{ background: "rgba(45,74,62,0.92)" }}
      data-testid="sticky-cta"
    >
      <Phone className="h-4 w-4 text-gold" />
      <span className="font-accent text-[11px] uppercase tracking-label">Book a Discovery Call</span>
    </Link>
  );
}

export default StickyCTA;
