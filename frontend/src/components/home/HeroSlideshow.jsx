import { useState, useEffect, useRef } from "react";
import { BRAND } from "@/data/content";
import { useMedia } from "@/hooks/useMedia";
import { useText, useRichText } from "@/context/ContentContext";
import { CTAButton } from "@/components/ui/CTAButton";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export function HeroSlideshow() {
  // Only render admin-managed hero images. No bundled defaults: we never
  // paint a stale photo (e.g. the seeded "lone tree") just because the API
  // hasn't returned yet. The section keeps its dark-ink background until the
  // real images arrive — which, with disk-backed WebP, happens in ~100 ms.
  const { items } = useMedia("hero");
  const HERO = items.map((s) => ({
    src: s.src,
    srcset: s.srcset || null,
    avif_srcset: s.avif_srcset || s.avifSrcset || null,
    lqip: s.lqip || "",
    alt: s.alt || s.caption || "Once Were Wild Travel, slow journey for women across Australia",
  }));

  // C7 — optional hero overlay tagline. Empty by default → pure photo
  // carousel. Falls back to legacy brand.tagline ONLY if the new key has
  // never been set (which won't happen after the seed runs, so production
  // sites with the seed applied are pure-photo by default).
  const heroTagline = useRichText("home.hero.tagline", "");
  const legacyTagline = useRichText("brand.tagline", BRAND.tagline);
  const tagline = heroTagline || ""; // explicit: blank-by-default
  const showOverlay = !!tagline; // only render the glass panel + tagline when set
  // Keep legacyTagline referenced to avoid unused-var lint and so a future
  // toggle can re-enable the old behaviour cleanly.
  void legacyTagline;
  const cta1 = useText("home.hero.cta_primary", "Explore Experiences");
  const cta2 = useText("home.hero.cta_secondary", "Join a Retreat");
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Whether the visitor has `prefers-reduced-motion: reduce` set. We still
  // cycle the slideshow in that case (otherwise the hero looks stuck — which
  // is what a real client saw on Windows with "Show animations" turned off);
  // we just disable the Ken Burns zoom AND lengthen the per-slide dwell time
  // so the rotation itself stays gentle.
  const [reduceMotion, setReduceMotion] = useState(false);
  const timer = useRef(null);

  // Preload behaviour: the backend bakes a static <link rel="preload"> tag
  // for the LCP hero image into index.html at HTML parse time (see
  // `regenerate_hero_preload` in server.py). That fires *before* the JS
  // bundle even downloads, which is the only way to hit < 2.5s LCP on
  // mobile. No JS-side preload is needed here.

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Track prefers-reduced-motion and react if the visitor toggles it.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduceMotion(!!e.matches);
    onChange(mq);
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (HERO.length <= 1) return undefined;
    const dwell = reduceMotion ? 9000 : 4500; // C7 — 4.5s per the brief
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % HERO.length);
    }, dwell);
    return () => clearInterval(timer.current);
  }, [HERO.length, reduceMotion]);

  // Manual nav helpers (arrows + dots). Reset the auto-advance timer so the
  // visitor isn't fighting the rotation right after they click.
  const goTo = (i) => {
    if (HERO.length === 0) return;
    const n = ((i % HERO.length) + HERO.length) % HERO.length;
    setIndex(n);
    if (timer.current) {
      clearInterval(timer.current);
      const dwell = reduceMotion ? 9000 : 4500;
      timer.current = setInterval(() => setIndex((x) => (x + 1) % HERO.length), dwell);
    }
  };
  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  return (
    <section className="hero-stage relative h-[100svh] w-full overflow-hidden bg-ink" data-testid="hero-slideshow">
      {/* Slides. ADMIN: replace images via /admin/hero or /admin/website-media */}
      {HERO.map((slide, i) => (
        <div
          key={i}
          className={`hero-slide absolute inset-0 ${i === index ? "active" : ""}`}
          aria-hidden={i !== index}
          data-testid={`hero-slide-${i + 1}`}
          // The LQIP is a ~600 B inline base64 WebP — paints in the FIRST
          // frame from the same HTML response, so the hero is never blank.
          // The full <img> overlays as soon as it decodes.
          style={slide.lqip ? {
            backgroundImage: `url(${slide.lqip})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.05)",
          } : undefined}
        >
          {(() => {
            // Build an AVIF srcset string when the API gave us one. AVIF
            // shaves another ~20-35% off WebP for the LCP image, which is
            // the single biggest mobile-perf lever after the bundle work.
            const webpSrcSet = slide.srcset
              ? Object.entries(slide.srcset).map(([w, u]) => `${u} ${w}`).join(", ")
              : undefined;
            const avifSrcSet = (slide.avif_srcset && Object.keys(slide.avif_srcset).length)
              ? Object.entries(slide.avif_srcset).map(([w, u]) => `${u} ${w}`).join(", ")
              : null;
            const imgEl = (
              <img
                src={slide.src}
                srcSet={webpSrcSet}
                sizes="100vw"
                alt={slide.alt}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={i === 0 ? "high" : "auto"}
                width="1600"
                height="1067"
                className={`h-full w-full object-cover ${i === index && !reduceMotion ? "animate-kenburns" : ""}`}
              />
            );
            if (!avifSrcSet) return imgEl;
            return (
              <picture>
                <source type="image/avif" srcSet={avifSrcSet} sizes="100vw" />
                {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes="100vw" />}
                {imgEl}
              </picture>
            );
          })()}
        </div>
      ))}

      {/* Cinematic gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-t from-nature-deep/85 via-nature-deep/30 to-nature-deep/45 pointer-events-none" />

      {/* Left / right arrow nav (C7) — desktop + tablet. Hidden when only
          one slide is present. */}
      {HERO.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={goPrev}
            className="hidden sm:flex absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/45 hover:text-white transition-colors"
            data-testid="hero-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={goNext}
            className="hidden sm:flex absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/45 hover:text-white transition-colors"
            data-testid="hero-next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Bottom overlay panel — only renders when an optional tagline is set
          via /admin/website-text → home.hero.tagline. CTAs always render so
          first-time visitors still have a clear path into /pricing. */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-12 sm:pb-16">
          {showOverlay ? (
            <div
              className="glass-dark rounded-sm px-7 py-9 sm:px-12 sm:py-12 max-w-3xl"
              style={{
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0)" : "translateY(40px)",
                transition: "opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1)",
              }}
              data-testid="hero-overlay"
            >
              <h1 className="font-display font-light text-white text-shadow-soft text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
                {tagline}
              </h1>
              <div className="mt-8 flex flex-col sm:flex-row gap-3.5">
                <CTAButton to="/pricing" variant="light" withArrow data-testid="hero-cta-experiences">
                  {cta1}
                </CTAButton>
                <CTAButton to="/pricing" variant="glass" withArrow data-testid="hero-cta-retreat">
                  {cta2}
                </CTAButton>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col sm:flex-row gap-3.5 max-w-3xl"
              style={{
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0)" : "translateY(40px)",
                transition: "opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1)",
              }}
              data-testid="hero-cta-row"
            >
              <CTAButton to="/pricing" variant="light" withArrow data-testid="hero-cta-experiences">
                {cta1}
              </CTAButton>
              <CTAButton to="/pricing" variant="glass" withArrow data-testid="hero-cta-retreat">
                {cta2}
              </CTAButton>
            </div>
          )}
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-6 right-6 z-10 hidden sm:flex gap-2" data-testid="hero-indicators">
        {HERO.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-500 ${i === index ? "w-8 bg-gold" : "w-4 bg-white/50"}`}
            data-testid={`hero-dot-${i + 1}`}
          />
        ))}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/70 animate-bounce hidden sm:block">
        <ChevronDown className="h-6 w-6" />
      </div>
    </section>
  );
}

export default HeroSlideshow;
