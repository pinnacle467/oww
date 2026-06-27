import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

// Helper - rewrite a relative /api/uploads path into an absolute URL when
// REACT_APP_BACKEND_URL is set, so the gallery works on the deployed CDN.
const abs = (u) => (u && API_BASE && u.startsWith("/") ? `${API_BASE}${u}` : u);
const absMap = (m) => {
  if (!m || typeof m !== "object") return null;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, abs(v)]));
};

// Photo gallery rendered below the body of a /tours/<slug> or
// /corporate-retreats/<slug> page. Receives `mediaIds` (ordered) and the
// pre-fetched `mediaMap` from the parent so we don't refetch /api/media.
// Items missing from the map are silently dropped so a stale id never
// breaks the page.
export function TourGallery({ mediaIds = [], mediaMap = {}, eyebrow, heading }) {
  const items = useMemo(() => {
    return (mediaIds || [])
      .map((id) => mediaMap[id])
      .filter(Boolean);
  }, [mediaIds, mediaMap]);

  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? null : Math.min(i + 1, items.length - 1)));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, items.length]);

  if (!items.length) return null;

  const active = lightboxIndex !== null ? items[lightboxIndex] : null;

  return (
    <section className="bg-cream/40 py-16 sm:py-20" data-testid="tour-gallery">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {eyebrow && (
          <p className="label-eyebrow text-nature-mid mb-3 text-center">{eyebrow}</p>
        )}
        {heading && (
          <h2 className="font-display font-light text-ink text-3xl sm:text-4xl text-center mb-10">
            {heading}
          </h2>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {items.map((m, i) => {
            const sset = absMap(m.srcset);
            const srcsetStr = sset
              ? Object.entries(sset).map(([w, u]) => `${u} ${w}`).join(", ")
              : "";
            const lqip = m.lqip || "";
            const fullUrl = abs(m.file_url);
            return (
              <button
                type="button"
                key={m.id || i}
                onClick={() => setLightboxIndex(i)}
                className="group relative aspect-square overflow-hidden rounded-sm bg-nature-deep/5 focus:outline-none focus:ring-2 focus:ring-gold"
                aria-label={`View image ${i + 1} of ${items.length}`}
                data-testid={`tour-gallery-thumb-${i}`}
              >
                <img
                  src={fullUrl}
                  srcSet={srcsetStr || undefined}
                  sizes="(min-width: 640px) 33vw, 50vw"
                  alt={m.alt || `Gallery image ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={lqip ? { backgroundImage: `url(${lqip})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox overlay */}
      {active && (
        <div
          className="fixed inset-0 z-[150] bg-ink/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          data-testid="tour-gallery-lightbox"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2"
            aria-label="Close"
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={abs(active.file_url)}
            alt={active.alt || "Gallery image"}
            className="max-h-[90vh] max-w-[92vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}

export default TourGallery;
