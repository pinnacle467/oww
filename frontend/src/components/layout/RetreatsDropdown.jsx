import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Corporate Retreats dropdown for the desktop navbar. Mirrors ToursDropdown
// but pulls from /api/retreats (which pre-filters to type='retreat') and
// links each item to /corporate-retreats/<slug>.
export function RetreatsDropdown({ solid, currentPath, parentLabel, parentTo }) {
  const [open, setOpen] = useState(false);
  const [retreats, setRetreats] = useState([]);
  const closeTimer = useRef(null);
  const location = useLocation();

  useEffect(() => {
    axios.get(`${API_BASE}/api/retreats`).then(({ data }) => {
      const usable = (data || []).filter((j) => j.slug);
      setRetreats(usable);
    }).catch(() => setRetreats([]));
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const isActive = currentPath === parentTo || currentPath.startsWith("/corporate-retreats");

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-testid="nav-retreats-dropdown"
    >
      <Link
        to={parentTo}
        className={cn(
          "font-accent text-base font-medium uppercase tracking-[0.12em] transition-colors duration-300 relative after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-gold after:transition-all after:duration-300 inline-flex items-center gap-1",
          isActive ? "after:w-full" : "after:w-0 hover:after:w-full",
          solid ? "text-ink hover:text-nature-mid" : "text-white hover:text-white text-shadow-soft",
        )}
        data-testid="nav-link-retreats"
        onFocus={handleEnter}
      >
        {parentLabel}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </Link>

      {retreats.length > 0 && (
        <div
          className={cn(
            "absolute left-1/2 top-full -translate-x-1/2 pt-4 transition-all duration-200",
            open ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1",
          )}
          data-testid="nav-retreats-dropdown-menu"
        >
          <div className="min-w-[280px] rounded-sm border border-nature-deep/12 bg-white shadow-xl py-2">
            {retreats.map((r) => (
              <Link
                key={r.id}
                to={`/corporate-retreats/${r.slug}`}
                className="block px-5 py-3 text-sm font-accent uppercase tracking-[0.08em] text-ink hover:bg-cream/60 hover:text-nature-deep transition-colors"
                data-testid={`nav-retreats-dropdown-item-${r.slug}`}
              >
                {r.name}
              </Link>
            ))}
            <div className="my-1 border-t border-nature-deep/10" />
            <Link
              to={parentTo}
              className="block px-5 py-3 text-sm font-accent uppercase tracking-[0.08em] text-nature-mid hover:bg-cream/60 hover:text-nature-deep transition-colors"
              data-testid="nav-retreats-dropdown-view-all"
            >
              View all retreats
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default RetreatsDropdown;
