import { useMemo } from "react";
import { SwipeableMedia } from "@/components/media/SwipeableMedia";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Helper - rewrite a relative /api/uploads path into an absolute URL when
// REACT_APP_BACKEND_URL is set, so the gallery works on the deployed CDN.
const abs = (u) => (u && API_BASE && u.startsWith("/") ? `${API_BASE}${u}` : u);
const absMap = (m) => {
  if (!m || typeof m !== "object") return null;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, abs(v)]));
};

// Photo / video gallery rendered above the price + CTA of a /tours/<slug>
// page. Phase 2 refactor: now consumes the shared <SwipeableMedia>
// component for site-wide consistency (swipe gestures, arrow buttons, dot
// indicators, fullscreen lightbox for images, inline video for MP4,
// YouTube / Vimeo embeds via iframe). Items missing from the map are
// silently dropped so a stale id never breaks the page.
export function TourGallery({ mediaIds = [], mediaMap = {}, eyebrow, heading }) {
  const items = useMemo(() => {
    return (mediaIds || [])
      .map((id) => mediaMap[id])
      .filter(Boolean)
      .map((m) => {
        const kind = m.file_type === "video" ? "video"
          : m.file_type === "embed" ? "embed"
          : "image";
        return {
          id: m.id,
          kind,
          url: abs(m.file_url),
          srcset: kind === "image" ? absMap(m.srcset) : null,
          avif_srcset: kind === "image" ? absMap(m.avif_srcset) : null,
          lqip: m.lqip || null,
          alt: m.alt_text || m.caption || m.alt || "",
          caption: m.caption || "",
          embed_provider: m.embed_provider || null,
          embed_id: m.embed_id || null,
        };
      });
  }, [mediaIds, mediaMap]);

  if (!items.length) return null;

  return (
    <section className="bg-cream/40 py-16 sm:py-20" data-testid="tour-gallery">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {eyebrow && (
          <p className="label-eyebrow text-nature-mid mb-3 text-center">{eyebrow}</p>
        )}
        {heading && (
          <h2 className="font-display font-light text-ink text-3xl sm:text-4xl text-center mb-8">
            {heading}
          </h2>
        )}
        <SwipeableMedia
          items={items}
          aspectRatio="16/9"
          testId="tour-gallery-swiper"
        />
      </div>
    </section>
  );
}

export default TourGallery;
