import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/data/content";
import { useContent, useText } from "@/context/ContentContext";
import { ToursDropdown } from "@/components/layout/ToursDropdown";

export function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { content } = useContent();
  const ctaLabel = useText("nav.cta", "Get In Touch");

  // Build nav from editable keys, falling back to defaults.
  const links = NAV_LINKS.map((l, i) => ({
    label: content[`nav.${i}.label`] || l.label,
    to: content[`nav.${i}.to`] || l.to,
  }));

  const overHero = location.pathname === "/" || location.pathname === "/charity";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const solid = scrolled || !overHero;
  const logo = solid ? "/assets/logo-light.png" : "/assets/logo-dark-trim.png";

  return (
    <>
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-[100] transition-all duration-500",
          solid ? "glass-solid py-3" : "glass py-4"
        )}
        data-testid="navbar"
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center" data-testid="nav-logo" aria-label="Once Were Wild home">
            <div
              className={cn(
                "transition-all duration-500",
                // Over the hero we wrap the logo in a soft dark pill so the
                // wordmark + "TRAVEL" subline keep contrast against any photo
                // (especially mid-tone beige/sand frames).
                !solid && "rounded-full bg-ink/30 backdrop-blur-md px-4 py-1.5",
              )}
            >
              {/* Modern WebP with PNG fallback. WebP cuts the white logo
                  from 35 KB to 18 KB and the dark logo from 67 KB to 27 KB,
                  shaving load time on the LCP element. */}
              <picture>
                <source
                  type="image/webp"
                  srcSet={solid ? "/assets/logo-nav-dark.webp" : "/assets/logo-nav-white.webp"}
                />
                <img
                  src={solid ? "/assets/logo-nav-dark.png" : "/assets/logo-nav-white.png"}
                  alt="Once Were Wild Travel"
                  width="474"
                  height="152"
                  fetchPriority="high"
                  decoding="async"
                  className={cn(
                    "w-auto block transition-all duration-500",
                    solid ? "h-[3.25rem] sm:h-[3.75rem]" : "h-14 sm:h-[4.25rem]",
                    // Layered drop-shadows: a tight dark edge + a soft halo so
                    // thin glyphs (the "TRAVEL" subline) never wash into the bg.
                    !solid && "[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.95))_drop-shadow(0_0_14px_rgba(0,0,0,0.7))]",
                  )}
                />
              </picture>
            </div>
          </Link>

          <div className="hidden items-center gap-9 lg:flex">
            {links.map((l) => {
              // The Tours nav item gets a dropdown of published tours. We
              // detect it by the destination (/pricing - the Tours index) so
              // the dropdown also kicks in if the client renames the label
              // in /admin/website-text.
              if (l.to === "/pricing") {
                return (
                  <ToursDropdown
                    key={l.to}
                    solid={solid}
                    currentPath={location.pathname}
                    parentLabel={l.label}
                    parentTo={l.to}
                  />
                );
              }
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "font-accent text-base font-medium uppercase tracking-[0.12em] transition-colors duration-300 relative after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-gold after:transition-all after:duration-300",
                    location.pathname === l.to ? "after:w-full" : "after:w-0 hover:after:w-full",
                    solid ? "text-ink hover:text-nature-mid" : "text-white hover:text-white text-shadow-soft"
                  )}
                  data-testid={`nav-link-${l.label.toLowerCase()}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/contact"
              // Always-on dark-fill + gold border + white text. Stays legible
              // over any hero image, snapshot or scrolled-state background.
              className="hidden sm:inline-flex rounded-full border border-gold px-7 py-3 font-accent text-base font-medium uppercase tracking-[0.12em] bg-ink/85 text-white hover:bg-gold hover:text-ink hover:border-gold shadow-[0_4px_18px_rgba(28,42,36,0.45)] transition-all duration-300"
              data-testid="nav-get-in-touch"
            >
              {ctaLabel}
            </Link>
            <button
              className={cn("lg:hidden p-2", solid ? "text-ink" : "text-white")}
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              data-testid="nav-mobile-open"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile full-screen glass overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[110] lg:hidden transition-all duration-500",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        data-testid="mobile-menu"
      >
        <div className="absolute inset-0 glass-dark" style={{ background: "rgba(28,42,36,0.92)" }} />
        <div className="relative flex h-full flex-col px-8 py-6">
          <div className="flex items-center justify-between">
            <img src="/assets/logo-nav-white.png" alt="Once Were Wild" width="160" height="64" className="h-16 w-auto" />
            <button onClick={() => setOpen(false)} className="text-white p-2" aria-label="Close menu" data-testid="nav-mobile-close">
              <X className="h-7 w-7" />
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2">
            {links.map((l, i) => (
              <Link
                key={l.to}
                to={l.to}
                className="font-display text-4xl font-light text-cream py-2"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease ${150 + i * 90}ms, transform 0.5s ease ${150 + i * 90}ms`,
                }}
                data-testid={`mobile-nav-link-${l.label.toLowerCase()}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link
            to="/contact"
            className="rounded-full border border-gold bg-ink/85 text-white text-center py-4 font-accent text-xs uppercase tracking-label hover:bg-gold hover:text-ink transition-colors"
            data-testid="mobile-nav-contact"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </>
  );
}

export default Navbar;
