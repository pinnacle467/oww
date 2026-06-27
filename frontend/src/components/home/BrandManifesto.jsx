import { MANIFESTO } from "@/data/content";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useText, useRichText } from "@/context/ContentContext";

export function BrandManifesto() {
  const eyebrow = useText("home.manifesto.eyebrow", MANIFESTO.eyebrow);
  const heading = useRichText("home.manifesto.heading", MANIFESTO.heading);
  const p0 = useText("home.manifesto.body.0", MANIFESTO.body[0]);
  const p1 = useText("home.manifesto.body.1", MANIFESTO.body[1]);
  const p2 = useText("home.manifesto.body.2", MANIFESTO.body[2]);
  const paragraphs = [p0, p1, p2];
  const pullQuote = useRichText("home.manifesto.pullQuote", MANIFESTO.pullQuote);

  return (
    <section className="relative bg-cream py-24 sm:py-32 overflow-hidden" data-testid="brand-manifesto">
      {/* Faint nature texture, CSS generated, no external asset */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 0%, rgba(141,181,160,0.18), transparent 60%), radial-gradient(50% 60% at 100% 100%, rgba(168,200,224,0.16), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <ScrollReveal>
              <p className="label-eyebrow text-nature-mid mb-6">{eyebrow}</p>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <h2 className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight">
                {heading}
              </h2>
            </ScrollReveal>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 space-y-6">
            {paragraphs.map((p, i) => (
              <ScrollReveal key={i} delay={120 + i * 80}>
                <p className="editorial text-ink-soft text-lg">{p}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>

        {/* Pull quote */}
        <ScrollReveal className="mt-24 sm:mt-32 text-center max-w-3xl mx-auto">
          <div className="mx-auto mb-7 h-px w-16 bg-gold" />
          <p className="font-display italic font-light text-ink text-3xl sm:text-4xl lg:text-[2.75rem] leading-tight">
            {pullQuote}
          </p>
          <div className="mx-auto mt-7 h-px w-16 bg-gold" />
        </ScrollReveal>
      </div>
    </section>
  );
}

export default BrandManifesto;
