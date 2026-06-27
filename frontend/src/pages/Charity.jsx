import { useEffect } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { MasonryGallery } from "@/components/gallery/MasonryGallery";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { CHARITY, GALLERY_ITEMS } from "@/data/content";
import { useMedia } from "@/hooks/useMedia";

export default function Charity() {
  useEffect(() => { document.title = "Charity and Community | Once Were Wild Travel"; }, []);
  const { items: charityImages } = useMedia("charity", GALLERY_ITEMS.slice(0, 4));

  return (
    <div data-testid="charity-page">
      <PageHero
        eyebrow="Giving Back"
        title={CHARITY.heading}
        intro={CHARITY.intro}
        image={CHARITY.hero}
      />

      {/* Impact stats */}
      <section className="bg-nature-deep py-20 sm:py-24" data-testid="charity-stats">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 grid grid-cols-2 lg:grid-cols-4 gap-10">
          {CHARITY.stats.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 100} className="text-center">
              <p className="font-display font-light text-gold text-5xl sm:text-6xl lg:text-7xl leading-none">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-3 font-accent text-[11px] uppercase tracking-label text-cream/70">{s.label}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Story rows */}
      <section className="bg-cream py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Our Initiatives" title={<>How the journeys <span className="italic">give back.</span></>} className="max-w-2xl mb-16" />
          <div className="space-y-20 sm:space-y-28">
            {CHARITY.stories.map((story, i) => (
              <div key={story.title} className={`grid gap-10 lg:grid-cols-2 lg:gap-16 items-center ${i % 2 ? "lg:[direction:rtl]" : ""}`}>
                <ScrollReveal mask className="lg:[direction:ltr]">
                  <div className="overflow-hidden rounded-sm">
                    <img src={story.img} alt={story.title} loading="lazy" className="w-full h-[340px] sm:h-[460px] object-cover" />
                  </div>
                </ScrollReveal>
                <div className="lg:[direction:ltr]">
                  <ScrollReveal>
                    <p className="label-eyebrow text-nature-mid mb-5">{`0${i + 1}`}</p>
                    <h3 className="font-display font-light text-ink text-3xl sm:text-4xl leading-tight mb-5">{story.title}</h3>
                    <p className="editorial text-ink-soft text-lg">{story.body}</p>
                  </ScrollReveal>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charity gallery */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="From the Field" title="Faces, places and small kindnesses." className="max-w-2xl mb-14" />
          <MasonryGallery items={charityImages} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-28" style={{ background: "#22382F" }}>
        <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
          <ScrollReveal>
            <h2 className="font-display font-light text-cream text-3xl sm:text-4xl lg:text-5xl leading-tight mb-6">
              Want to walk alongside us?
            </h2>
            <p className="editorial text-cream/75 text-lg mb-9">
              Whether you would like to contribute, donate, or gift a journey to a woman who needs it, we would love to hear from you.
            </p>
            <CTAButton to="/contact" variant="gold" withArrow data-testid="charity-cta">Ask about contributing</CTAButton>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
