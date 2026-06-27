import { MALENY } from "@/data/content";
import { CTAButton } from "@/components/ui/CTAButton";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { FadeImg } from "@/components/ui/FadeImg";
import { useText, useRichText, useTextList } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";

export function MalenyFeature() {
  const eyebrow = useText("home.maleny.eyebrow", MALENY.eyebrow);
  const heading = useRichText("home.maleny.heading", MALENY.heading);
  const body = useText("home.maleny.body", MALENY.body);
  const tags = useTextList("home.maleny.tags", MALENY.tags);
  const cta = useText("home.maleny.cta", "Explore the retreat");
  const { src, srcset } = useMediaSlot("maleny");

  return (
    <section className="bg-cream py-24 sm:py-32" data-testid="maleny-feature">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
          {/* Image with subtle fade-up reveal (no clip-path mask: caused IO timing issues) */}
          <ScrollReveal className="order-1 lg:order-none">
            <div className="relative overflow-hidden rounded-sm bg-cream/50">
              <FadeImg src={src} srcset={srcset} sizes="(min-width: 1024px) 50vw, 100vw" alt="The Maleny hinterland garden where the Once Were Wild creative retreat unfolds" width="1200" height="800" loading="lazy" className="w-full h-[420px] sm:h-[560px] object-cover" />
              <div className="absolute inset-0 ring-1 ring-inset ring-nature-deep/10 rounded-sm" />
            </div>
          </ScrollReveal>

          <div>
            <ScrollReveal>
              <p className="label-eyebrow text-nature-mid mb-6">{eyebrow}</p>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <h2 className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight mb-7">
                {heading}
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={140}>
              <p className="editorial text-ink-soft text-lg mb-9">{body}</p>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div className="flex flex-wrap gap-3 mb-10">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-nature-light/70 bg-white px-5 py-2 font-accent text-[11px] uppercase tracking-label text-nature-deep"
                    data-testid={`maleny-tag-${t}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </ScrollReveal>
            <ScrollReveal delay={260}>
              <CTAButton to="/pricing" variant="filled" withArrow data-testid="maleny-cta">
                {cta}
              </CTAButton>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MalenyFeature;
