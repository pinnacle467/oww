import { CHARITY_TEASER } from "@/data/content";
import { CTAButton } from "@/components/ui/CTAButton";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function CharityTeaser() {
  return (
    <section className="relative py-24 sm:py-32" style={{ background: "#22382F" }} data-testid="charity-teaser">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20 items-center">
          <div>
            <ScrollReveal>
              <p className="label-eyebrow text-gold mb-6">{CHARITY_TEASER.eyebrow}</p>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <h2 className="font-display font-light text-cream text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight mb-7">
                {CHARITY_TEASER.heading}
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={140}>
              <p className="editorial text-cream/75 text-lg mb-9 max-w-xl">{CHARITY_TEASER.body}</p>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <CTAButton to="/charity" variant="gold" withArrow data-testid="charity-teaser-cta">
                See Our Work
              </CTAButton>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {CHARITY_TEASER.images.map((src, i) => (
              <ScrollReveal key={i} mask delay={i * 120} className={i === 1 ? "mt-8" : ""}>
                <div className="overflow-hidden rounded-sm">
                  {/* ADMIN: replace charity images via /admin/charity */}
                  <img src={src} alt="Community and giving back" loading="lazy" className="h-44 sm:h-64 w-full object-cover" />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CharityTeaser;
