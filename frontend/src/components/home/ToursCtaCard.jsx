import { CTAButton } from "@/components/ui/CTAButton";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useText, useRichText } from "@/context/ContentContext";

// Compact CTA card that replaces the older repeated Tasmania (ImmersiveTeaser)
// + Maleny (MalenyFeature) marketing blocks on the home page. The full tour
// information lives on the Tours page and on each tour's own sub-page; this
// component is just a single nudge to send visitors there.
export function ToursCtaCard() {
  const eyebrow = useText("home.tours_cta.eyebrow", "Our Journeys");
  const title = useRichText("home.tours_cta.title", "Slow tours, *soulful retreats.*");
  const body = useText(
    "home.tours_cta.body",
    "Small group journeys across Australia and beyond, plus immersive Maleny retreats in the Sunshine Coast hinterland."
  );
  const button = useText("home.tours_cta.button", "Explore all tours");

  return (
    <section className="bg-white py-20 sm:py-24" data-testid="home-tours-cta">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <ScrollReveal>
          <div className="text-center rounded-sm border border-nature-deep/15 bg-cream/40 px-8 py-14 sm:px-14 sm:py-16">
            {eyebrow && <p className="label-eyebrow text-nature-mid mb-5">{eyebrow}</p>}
            <h2 className="font-display font-light text-ink text-3xl sm:text-4xl leading-[1.1] tracking-tight mb-5">
              {title}
            </h2>
            {body && <p className="editorial text-ink-soft text-lg max-w-xl mx-auto mb-9">{body}</p>}
            <CTAButton to="/pricing" variant="filled" withArrow data-testid="home-tours-cta-button">
              {button}
            </CTAButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default ToursCtaCard;
