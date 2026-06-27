import { useEffect, useState } from "react";
import { CTAButton } from "@/components/ui/CTAButton";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { FadeImg } from "@/components/ui/FadeImg";
import { useText, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";

// Featured immersive teaser with a gentle CSS parallax (disabled on mobile).
export function ImmersiveTeaser() {
  const [offset, setOffset] = useState(0);
  const eyebrow = useText("home.immersive.eyebrow", "Featured Journey");
  const heading = useRichText("home.immersive.heading", "Slow and Soulful Tasmania");
  const body = useText("home.immersive.body", "Twenty three nights of untamed coastline, pristine wilderness and farm to table flavour, shared with a small circle of like minded women.");
  const cta = useText("home.immersive.cta", "Discover More");
  const { src, srcset } = useMediaSlot("immersive");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (reduce || isMobile) return;
    const onScroll = () => {
      const el = document.getElementById("immersive-teaser");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      setOffset(Math.max(-1, Math.min(1, progress)) * 60); // max ~20% movement
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="immersive-teaser" className="relative h-[80vh] min-h-[560px] overflow-hidden flex items-center justify-center" data-testid="immersive-teaser">
      <div className="absolute inset-0 will-change-transform" style={{ transform: `translateY(${offset - 30}px) scale(1.15)` }}>
        <FadeImg src={src} srcset={srcset} sizes="100vw" alt="A quiet passage opening toward the ocean, Once Were Wild slow travel" width="1600" height="900" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="absolute inset-0 bg-ocean-deep/45" />
      <ScrollReveal className="relative z-10 mx-5 w-full max-w-2xl">
        <div className="glass rounded-sm px-8 py-12 sm:px-14 sm:py-16 text-center">
          <p className="label-eyebrow text-gold mb-5">{eyebrow}</p>
          <h2 className="font-display font-light text-white text-shadow-soft text-3xl sm:text-4xl lg:text-5xl leading-tight mb-5">
            {heading}
          </h2>
          <p className="editorial text-white/85 mb-8 max-w-lg mx-auto">
            {body}
          </p>
          <CTAButton to="/pricing" variant="light" withArrow data-testid="immersive-cta">
            {cta}
          </CTAButton>
        </div>
      </ScrollReveal>
    </section>
  );
}

export default ImmersiveTeaser;
