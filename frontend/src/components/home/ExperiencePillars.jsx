import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PILLARS } from "@/data/content";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { FadeImg } from "@/components/ui/FadeImg";
import { useText, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";

function PillarCard({ index, fallback, delay }) {
  const title = useText(`pillars.${index}.title`, fallback.title);
  const desc = useText(`pillars.${index}.desc`, fallback.desc);
  const cta = useText(`pillars.${index}.cta`, fallback.cta);
  const to = useText(`pillars.${index}.to`, fallback.to);
  // useMediaSlot provides srcset (small/medium/large) and matching AVIF
  // variants when available. AVIF cuts bytes another 20-35% over WebP.
  const { src, srcset, avifSrcset } = useMediaSlot(`pillars-${index}`);

  return (
    <ScrollReveal delay={delay}>
      <Link
        to={to}
        className="group block h-full relative overflow-hidden rounded-sm"
        data-testid={`pillar-card-${index + 1}`}
      >
        <div className="absolute inset-0 bg-nature-deep">
          <FadeImg
            src={src}
            srcset={srcset}
            avifSrcset={avifSrcset}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-nature-deep/90 via-nature-deep/30 to-transparent" />
        </div>
        <div className="relative flex h-full min-h-[420px] flex-col justify-end p-7">
          <div className="glass-dark rounded-sm p-6 transition-all duration-500 group-hover:-translate-y-2 group-hover:border-nature-light/60"
            style={{ boxShadow: "0 0 0 rgba(141,181,160,0)" }}>
            <h3 className="font-display text-2xl sm:text-3xl font-light text-cream mb-2.5">{title}</h3>
            <p className="editorial text-cream/75 text-sm mb-5">{desc}</p>
            <span className="inline-flex items-center gap-2 font-accent text-[11px] uppercase tracking-label text-gold">
              {cta} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>
    </ScrollReveal>
  );
}

export function ExperiencePillars() {
  const eyebrow = useText("home.pillars.eyebrow", "How We Travel");
  const title = useRichText("home.pillars.title", "Three ways to step *beyond the familiar.*");

  return (
    <section className="relative py-24 sm:py-32 bg-nature-deep overflow-hidden" data-testid="experience-pillars">
      <div className="absolute inset-0 opacity-20">
        <img src="/assets/images/hero/hero-01.webp" alt="" width="1600" height="900" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      </div>
      <div className="absolute inset-0 bg-nature-deep/70" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          light
          className="max-w-2xl mb-16"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <PillarCard key={i} index={i} fallback={p} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExperiencePillars;
