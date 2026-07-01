import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Play } from "lucide-react";
import { useSwipeNav } from "@/hooks/useSwipeNav";

// Shared, site-wide swipeable media component (Phase 2 of Changes 1-9).
//
// Renders an array of mixed media items - images, MP4 videos and external
// YouTube / Vimeo embeds - in a horizontal carousel that:
//   * occupies the same vertical space as a single item (no strip stacking),
//   * supports mobile / tablet touch swipe (left / right),
//   * shows desktop arrow buttons (left / right),
//   * shows dot indicators + "N of M" position label below,
//   * opens images in a full-screen lightbox on tap or Enter,
//   * plays MP4 videos inline (native <video controls>),
//   * embeds YouTube / Vimeo via privacy-friendly iframes.
//
// Items shape (every field is optional except `kind` and `url`):
//   { kind: "image" | "video" | "embed",
//     url:  string,                     // image src, MP4 src, or full embed page URL
//     srcset:        object|null,       // { "640": "/path.webp", "1280": "/path.webp" }
//     avif_srcset:   object|null,
//     lqip:          string|null,       // low-quality placeholder data URI
//     alt:           string|null,
//     caption:       string|null,
//     embed_provider: "youtube"|"vimeo"|null,  // optional - inferred from url if missing
//     embed_id:       string|null,             // optional - inferred from url if missing
//   }
//
// Used by: About travel gallery, TourGallery, Gallery page lightbox,
// FromTheJournal, BlogIndex, BlogPost, hero carousel, etc.

function srcsetToString(map) {
  if (!map || typeof map !== "object") return undefined;
  const entries = Object.entries(map);
  if (!entries.length) return undefined;
  return entries.map(([w, u]) => `${u} ${w}`).join(", ");
}

// Parse a full YouTube / Vimeo URL into { provider, id }. Accepts the common
// shapes - watch?v=, youtu.be/, shorts/, vimeo.com/{id}, vimeo.com/channels/.../
// player.vimeo.com/video/{id}. Returns null if the URL is not a recognised
// host so the caller can fall back to inline <video> or a plain link.
export function parseEmbedUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return { provider: "youtube", id };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v) return { provider: "youtube", id: v };
      const m = u.pathname.match(/^\/(shorts|embed|v)\/([\w-]{6,})/);
      if (m) return { provider: "youtube", id: m[2] };
    }
    if (host === "vimeo.com") {
      const m = u.pathname.match(/(\d{6,})/);
      if (m) return { provider: "vimeo", id: m[1] };
    }
    if (host === "player.vimeo.com") {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m) return { provider: "vimeo", id: m[1] };
    }
  } catch {
    // Not a URL at all - bail out
    return null;
  }
  return null;
}

function MediaSlide({ item, isActive, onOpenLightbox }) {
  const kind = item.kind || "image";

  if (kind === "video") {
    return (
      <div className="relative h-full w-full bg-black flex items-center justify-center" data-testid="swipeable-slide-video">
        <video
          src={item.url}
          poster={item.poster || item.lqip || undefined}
          controls
          playsInline
          preload={isActive ? "metadata" : "none"}
          className="max-h-full max-w-full"
        >
          {item.caption && <track kind="captions" label={item.caption} />}
        </video>
      </div>
    );
  }

  if (kind === "embed") {
    let provider = item.embed_provider;
    let id = item.embed_id;
    if (!provider || !id) {
      const parsed = parseEmbedUrl(item.url);
      if (parsed) { provider = parsed.provider; id = parsed.id; }
    }
    if (provider === "youtube" && id) {
      const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
      return (
        <div className="relative h-full w-full bg-black flex items-center justify-center" data-testid="swipeable-slide-embed-youtube">
          <iframe
            src={isActive ? src : ""}
            title={item.alt || item.caption || "Embedded video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    if (provider === "vimeo" && id) {
      const src = `https://player.vimeo.com/video/${id}?dnt=1`;
      return (
        <div className="relative h-full w-full bg-black flex items-center justify-center" data-testid="swipeable-slide-embed-vimeo">
          <iframe
            src={isActive ? src : ""}
            title={item.alt || item.caption || "Embedded video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    // Unrecognised embed - render the URL as a clickable link rather than
    // breaking the carousel.
    return (
      <div className="relative h-full w-full bg-ink/80 flex items-center justify-center text-center p-6" data-testid="swipeable-slide-embed-unknown">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-cream underline text-sm font-accent">
          {item.alt || item.caption || "Open video"}
        </a>
      </div>
    );
  }

  // image (default)
  const webpSrcSet = srcsetToString(item.srcset);
  const avifSrcSet = srcsetToString(item.avif_srcset);
  return (
    <button
      type="button"
      onClick={() => onOpenLightbox && onOpenLightbox()}
      className="relative h-full w-full block bg-nature-deep/10 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      aria-label={item.alt || "Open photo"}
      data-testid="swipeable-slide-image"
      style={item.lqip ? {
        backgroundImage: `url(${item.lqip})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      <picture>
        {avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} />}
        {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} />}
        <img
          src={item.url}
          alt={item.alt || ""}
          loading={isActive ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </picture>
    </button>
  );
}

function Lightbox({ items, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  // Phase 4: touch swipe on mobile devices. Vertical drags still pass
  // through (touchAction: pan-y) and video controls are unaffected.
  const swipe = useSwipeNav({
    onNext: items.length > 1 ? onNext : undefined,
    onPrev: items.length > 1 ? onPrev : undefined,
  });

  const it = items[index];
  if (!it) return null;
  const webpSrcSet = srcsetToString(it.srcset);
  const avifSrcSet = srcsetToString(it.avif_srcset);

  // Render via a portal to document.body so the lightbox isn't trapped
  // inside any ancestor that has a `transform`/`will-change: transform`
  // (e.g. our `.reveal` ScrollReveal wrapper). Such ancestors create a
  // containing block for `position: fixed` descendants, which would
  // otherwise leave sticky sidebars / tabs visible on top of the lightbox.
  if (typeof document === "undefined") return null;
  return createPortal((
    <div
      className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      data-testid="swipeable-lightbox"
      role="dialog"
      aria-modal="true"
      {...swipe}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="Close"
        data-testid="lightbox-close"
      >
        <X className="h-5 w-5" />
      </button>
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Previous"
            data-testid="lightbox-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Next"
            data-testid="lightbox-next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <picture onClick={(e) => e.stopPropagation()}>
        {avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} />}
        {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} />}
        <img
          src={it.url}
          alt={it.alt || ""}
          className="max-h-[92vh] max-w-[94vw] object-contain"
        />
      </picture>
      {(it.caption || it.alt) && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/85 text-sm max-w-xl text-center px-4">
          {it.caption || it.alt}
        </p>
      )}
    </div>
  ), document.body);
}

export function SwipeableMedia({
  items,
  aspectRatio = "16/9",   // "16/9", "4/3", "1/1", "21/9" — applied to the slot
  className = "",
  testId,
  rounded = "rounded-sm",
  showDots = true,
  showCounter = true,
  showArrows = true,
  enableLightbox = true,
}) {
  // Normalise null / undefined items into an empty list so all helpers are safe.
  const list = useMemo(() => Array.isArray(items) ? items.filter(Boolean) : [], [items]);
  const [index, setIndex] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);
  const containerRef = useRef(null);
  const startX = useRef(null);
  const startY = useRef(null);
  const swipeLock = useRef(false);

  // Reset index if the items list shrinks below the current pointer.
  useEffect(() => {
    if (index >= list.length) setIndex(Math.max(0, list.length - 1));
  }, [list.length, index]);

  const goTo = useCallback((i) => {
    if (list.length === 0) return;
    const n = ((i % list.length) + list.length) % list.length;
    setIndex(n);
  }, [list.length]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  // Touch swipe handlers (passive, no preventDefault on touchmove so vertical
  // page scroll still works freely).
  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    swipeLock.current = false;
  };
  const onTouchMove = (e) => {
    if (startX.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!swipeLock.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeLock.current = true;
    }
  };
  const onTouchEnd = (e) => {
    if (startX.current == null) return;
    const endX = (e.changedTouches && e.changedTouches[0].clientX) || startX.current;
    const dx = endX - startX.current;
    startX.current = null;
    startY.current = null;
    if (!swipeLock.current) return;
    if (Math.abs(dx) > 40) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  if (list.length === 0) return null;

  const onSlideKey = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
  };

  return (
    <div
      className={`relative ${className}`}
      data-testid={testId || "swipeable-media"}
      ref={containerRef}
      onKeyDown={onSlideKey}
      tabIndex={0}
    >
      <div
        className={`relative w-full overflow-hidden bg-nature-deep/5 ${rounded}`}
        style={{ aspectRatio }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {list.map((it, i) => (
            <div key={it.id || it.url || i} className="h-full w-full shrink-0">
              <MediaSlide
                item={it}
                isActive={i === index}
                onOpenLightbox={enableLightbox && (it.kind === "image" || !it.kind)
                  ? () => setLbOpen(true)
                  : null}
              />
            </div>
          ))}
        </div>

        {showArrows && list.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/50 transition-colors"
              data-testid="swipeable-prev"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/50 transition-colors"
              data-testid="swipeable-next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Subtle play badge bottom-left on video slides */}
        {list[index] && (list[index].kind === "video" || list[index].kind === "embed") && (
          <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-white text-[11px] font-accent uppercase tracking-label">
            <Play className="h-3 w-3" /> Video
          </div>
        )}
      </div>

      {list.length > 1 && (showDots || showCounter) && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-soft" data-testid="swipeable-controls">
          {showDots ? (
            <div className="flex gap-1.5" data-testid="swipeable-dots">
              {list.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to item ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-nature-deep" : "w-2.5 bg-nature-deep/30"}`}
                  data-testid={`swipeable-dot-${i + 1}`}
                />
              ))}
            </div>
          ) : <span />}
          {showCounter && (
            <span className="font-accent uppercase tracking-label text-[11px]" data-testid="swipeable-counter">
              {index + 1} of {list.length}
            </span>
          )}
        </div>
      )}

      {enableLightbox && lbOpen && (() => {
        // Build an image-only sub-list for the lightbox; map the current
        // carousel index to the position of the same item within that
        // filtered list (or the closest preceding image).
        const imageList = list.filter((it) => it.kind !== "video" && it.kind !== "embed");
        let startIdx = imageList.indexOf(list[index]);
        if (startIdx < 0) {
          startIdx = 0;
          for (let i = index; i >= 0; i--) {
            const inImg = imageList.indexOf(list[i]);
            if (inImg >= 0) { startIdx = inImg; break; }
          }
        }
        return (
          <MediaLightbox
            items={imageList}
            openIndex={startIdx}
            onClose={() => setLbOpen(false)}
          />
        );
      })()}
    </div>
  );
}

// Standalone lightbox wrapper so callers without the carousel can still
// open images in fullscreen (e.g. legacy TourGallery while migrating).
export function MediaLightbox({ items, openIndex, onClose }) {
  const [i, setI] = useState(openIndex || 0);
  useEffect(() => { setI(openIndex || 0); }, [openIndex]);
  if (!items || !items.length || openIndex == null) return null;
  return (
    <Lightbox
      items={items}
      index={i}
      onClose={onClose}
      onPrev={() => setI((x) => (x - 1 + items.length) % items.length)}
      onNext={() => setI((x) => (x + 1) % items.length)}
    />
  );
}

export default SwipeableMedia;
