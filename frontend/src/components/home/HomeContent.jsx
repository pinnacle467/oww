import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useText, useRichText } from "@/context/ContentContext";
import { SwipeableMedia } from "@/components/media/SwipeableMedia";
import { FadeImg } from "@/components/ui/FadeImg";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const abs = (u) => (u && API_BASE && u.startsWith("/") ? `${API_BASE}${u}` : u);
const absMap = (m) => {
  if (!m || typeof m !== "object") return null;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, abs(v)]));
};

// Build SwipeableMedia items from an ordered list of media.id values + a
// resolved media map. Items missing from the map are dropped so a stale id
// never breaks the page.
function buildItems(ids, mediaMap, fallbackAlt) {
  return (ids || [])
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
        alt: m.alt_text || m.caption || m.alt || fallbackAlt || "",
        caption: m.caption || "",
        embed_provider: m.embed_provider || null,
        embed_id: m.embed_id || null,
      };
    });
}

// Long-form rich-text content sections shown on the home page. Each section
// renders an editable H2 + optional gallery + HTML body (TipTap output).
// Auto-hides if no visible sections so the page never shows an empty area.
export function HomeContent() {
  const eyebrow = useText("home.content.eyebrow", "More to know");
  const title = useRichText("home.content.title", "Slow stories, *gently shared.*");

  const [items, setItems] = useState(null);
  const [mediaMap, setMediaMap] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get("/home-sections"),
      api.get("/media").catch(() => ({ data: [] })),
    ])
      .then(([sectionsRes, mediaRes]) => {
        if (!alive) return;
        setItems(Array.isArray(sectionsRes.data) ? sectionsRes.data : []);
        const m = {};
        (mediaRes.data || []).forEach((row) => { m[row.id] = row; });
        setMediaMap(m);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => { alive = false; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="bg-cream py-24 sm:py-28" data-testid="home-content-sections">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        {eyebrow && (
          <ScrollReveal>
            <p className="label-eyebrow text-nature-mid mb-5 text-center">{eyebrow}</p>
          </ScrollReveal>
        )}
        {title && (
          <ScrollReveal delay={80}>
            <h2 className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight text-center mb-14">
              {title}
            </h2>
          </ScrollReveal>
        )}
        <div className="space-y-14">
          {items.map((s, i) => (
            <HomeSection
              key={s.id || i}
              section={s}
              index={i}
              mediaMap={mediaMap}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeSection({ section, index, mediaMap }) {
  const galleryItems = useMemo(
    () => buildItems(section.media_ids, mediaMap, section.heading),
    [section.media_ids, section.heading, mediaMap],
  );

  return (
    <ScrollReveal delay={120 + index * 60}>
      <article data-testid={`home-section-${index}`}>
        {section.heading && (
          <h3 className="font-display text-2xl sm:text-3xl font-light text-ink leading-tight tracking-tight mb-4">
            {section.heading}
          </h3>
        )}

        {/* Phase 3 - optional inline gallery above the body. Single image
            renders as a plain hero; 2+ items render the swipeable carousel. */}
        {galleryItems.length > 1 && (
          <div className="mb-6" data-testid={`home-section-gallery-${index}`}>
            <SwipeableMedia
              items={galleryItems}
              aspectRatio="16/9"
              testId={`home-section-swiper-${index}`}
            />
          </div>
        )}
        {galleryItems.length === 1 && galleryItems[0].kind === "image" && (
          <div className="mb-6 aspect-[16/9] overflow-hidden rounded-md bg-nature-deep/5" data-testid={`home-section-gallery-${index}`}>
            <FadeImg
              src={galleryItems[0].url}
              srcset={galleryItems[0].srcset}
              avifSrcset={galleryItems[0].avif_srcset}
              lqip={galleryItems[0].lqip}
              alt={galleryItems[0].alt}
              className="w-full h-full object-cover"
              sizes="(min-width: 1024px) 896px, 100vw"
            />
          </div>
        )}
        {galleryItems.length === 1 && galleryItems[0].kind !== "image" && (
          <div className="mb-6" data-testid={`home-section-gallery-${index}`}>
            <SwipeableMedia
              items={galleryItems}
              aspectRatio="16/9"
              testId={`home-section-swiper-${index}`}
            />
          </div>
        )}

        <div
          className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg editorial"
          dangerouslySetInnerHTML={{ __html: section.body || "" }}
        />
      </article>
    </ScrollReveal>
  );
}

export default HomeContent;
