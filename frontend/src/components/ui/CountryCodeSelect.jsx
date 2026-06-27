import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { COUNTRIES } from "@/data/countries";

// Custom country dial-code selector. Built (not a native select) so the open
// list fully matches the glass theme with readable white text on a dark panel.
export function CountryCodeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.n.toLowerCase().includes(q) || c.d.includes(q) || c.c.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-full px-1 py-3 text-white border-b border-white/30 hover:border-gold focus:border-gold outline-none transition-colors min-w-[92px]"
        data-testid="country-code-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country dial code, currently ${value.n} (${value.d})`}
      >
        <span className="text-lg leading-none">{value.f}</span>
        <span className="font-body text-white">{value.d}</span>
        <ChevronDown className={`h-4 w-4 text-white/70 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-72 max-w-[80vw] rounded-sm overflow-hidden glass-dark shadow-2xl"
          style={{ background: "rgba(20,30,26,0.92)" }}
          data-testid="country-code-panel"
          role="listbox"
        >
          <div className="p-2.5 border-b border-white/12">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code"
                className="w-full bg-white/10 rounded-sm pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/45 outline-none focus:bg-white/15 transition-colors"
                data-testid="country-code-search"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1 no-scrollbar">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-white/55">No matches found</li>
            )}
            {filtered.map((c) => {
              const active = c.c === value.c;
              return (
                <li key={c.c}>
                  <button
                    type="button"
                    onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? "bg-gold/20 text-gold" : "text-cream/90 hover:bg-white/10"}`}
                    data-testid={`country-option-${c.c}`}
                    role="option"
                    aria-selected={active}
                  >
                    <span className="text-lg leading-none">{c.f}</span>
                    <span className="flex-1 text-sm truncate">{c.n}</span>
                    <span className="text-sm text-white/60">{c.d}</span>
                    {active && <Check className="h-4 w-4 text-gold shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CountryCodeSelect;
