import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Tours dropdown for the desktop navbar. Fetches the live published tour
// list once and renders sub-links beneath the parent "Tours" entry. The
// parent label itself remains a regular link to /pricing (Tours index) for
// keyboard users and screen readers. The dropdown is purely an enhancement.
export function ToursDropdown({ solid, currentPath, parentLabel, parentTo }) {
  const [open, setOpen] = useState(false);
  const [tours, setTours] = useState([]);
  const closeTimer = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // B2: server-side filter to type=tour so retreats (e.g. Maleny) never
    // leak into this dropdown. Legacy rows with no type are also returned
    // by the backend when type=tour.
    axios.get(`${API_BASE}/api/journeys?type=tour`).then(({ data }) => {
      const usable = (data || []).filter((j) => j.slug);
      setTours(usable);
    }).catch(() => setTours([]));
  }, []);

  // Close the menu when the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const isActive = currentPath === parentTo || currentPath.startsWith("/tours/");

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-testid="nav-tours-dropdown"
    >
      <Link
        to={parentTo}
        className={cn(
          "font-accent text-base font-medium uppercase tracking-[0.12em] transition-colors duration-300 relative after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-gold after:transition-all after:duration-300 inline-flex items-center gap-1",
          isActive ? "after:w-full" : "after:w-0 hover:after:w-full",
          solid ? "text-ink hover:text-nature-mid" : "text-white hover:text-white text-shadow-soft",
        )}
        data-testid="nav-link-tours"
        onFocus={handleEnter}
      >
        {parentLabel}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </Link>

      {tours.length > 0 && (
        <div
          className={cn(
            "absolute left-1/2 top-full -translate-x-1/2 pt-4 transition-all duration-200",
            open ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1",
          )}
          data-testid="nav-tours-dropdown-menu"
        >
          <div className="min-w-[280px] rounded-sm border border-nature-deep/12 bg-white shadow-xl py-2">
            {tours.map((t) => (
              <Link
                key={t.id}
                to={`/tours/${t.slug}`}
                className="block px-5 py-3 text-sm font-accent uppercase tracking-[0.08em] text-ink hover:bg-cream/60 hover:text-nature-deep transition-colors"
                data-testid={`nav-tours-dropdown-item-${t.slug}`}
              >
                {t.name}
              </Link>
            ))}
            <div className="my-1 border-t border-nature-deep/10" />
            <Link
              to={parentTo}
              className="block px-5 py-3 text-sm font-accent uppercase tracking-[0.08em] text-nature-mid hover:bg-cream/60 hover:text-nature-deep transition-colors"
              data-testid="nav-tours-dropdown-view-all"
            >
              View all tours
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToursDropdown;
