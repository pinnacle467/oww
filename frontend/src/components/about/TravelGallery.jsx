import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { SwipeableMedia } from "@/components/media/SwipeableMedia";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useText } from "@/context/ContentContext";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Public About Us travel gallery (Phase 2 of Changes 1-9, item 2.2).
// Pulls media rows tagged section="about-travel" and feeds them into the
// shared <SwipeableMedia>. Mixed photos / uploaded videos / YouTube and
// Vimeo embeds all live side-by-side; the operator controls order via
// /admin/travel-media.
//
// Self-hides when the collection is empty so the public page never shows
// a blank gallery during the period between "feature shipped" and "first
// upload".

function absolutise(urlMap) {
  if (!urlMap || typeof urlMap !== "object") return null;
  return Object.fromEntries(
    Object.entries(urlMap).map(([k, v]) => [k, API_BASE && v && !String(v).startsWith("http") ? `${API_BASE}${v}` : v])
  );
}

function abs(url) {
  if (!url) return url;
  if (String(url).startsWith("http") || String(url).startsWith("data:")) return url;
  return API_BASE ? `${API_BASE}${url}` : url;
}

function mediaToItem(m) {
  const kind = m.file_type === "video" ? "video"
    : m.file_type === "embed" ? "embed"
    : "image";
  return {
    id: m.id,
    kind,
    url: abs(m.file_url),
    srcset: kind === "image" ? absolutise(m.srcset) : null,
    avif_srcset: kind === "image" ? absolutise(m.avif_srcset) : null,
    poster: kind === "video" ? abs(m.thumb_url) : null,
    lqip: m.lqip || null,
    alt: m.alt_text || m.caption || "",
    caption: m.caption || "",
    embed_provider: m.embed_provider || null,
    embed_id: m.embed_id || null,
  };
}

export function TravelGallery() {
  const [items, setItems] = useState([]);
  const eyebrow = useText("about.travel.eyebrow", "From the road");
  const title = useText("about.travel.title", "Travel notes in photos and video");

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/media`, { params: { section: "about-travel" } })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  const mediaItems = useMemo(() => items.map(mediaToItem), [items]);

  if (!mediaItems.length) return null;

  return (
    <section className="bg-cream py-16 sm:py-24" data-testid="about-travel-gallery">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <ScrollReveal>
          <p className="label-eyebrow text-nature-mid mb-3">{eyebrow}</p>
          <h2 className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight mb-8">
            {title}
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={120}>
          <SwipeableMedia
            items={mediaItems}
            aspectRatio="16/9"
            testId="about-travel-swiper"
          />
        </ScrollReveal>
      </div>
    </section>
  );
}

export default TravelGallery;
