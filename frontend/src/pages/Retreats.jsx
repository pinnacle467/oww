import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight, Check } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { useText, useRichText } from "@/context/ContentContext";
import { Seo } from "@/components/seo/Seo";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Public index of Corporate Retreats — mirrors the structure of /pricing
// but for `type="retreat"` rows only. The Maleny Creative Immersion (re-
// tagged on backend startup) is currently the only retreat; the page is
// designed to scale to N cards as the client adds more.
export default function Retreats() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const heroEyebrow = useText("retreats.hero.eyebrow", "Corporate and Custom Retreats");
  const heroTitle = useRichText("retreats.hero.title", "Step out of the noise, *into the rainforest.*");
  const heroIntro = useText("retreats.hero.intro", "Curated, fully hosted retreats for teams, families and milestone groups. Build a journey from scratch around what matters to your people.");
  const enquireLabel = useText("retreats.cta.enquire", "Start a conversation");
  const emptyHeading = useText("retreats.empty.heading", "New retreats are on their way.");
  const emptyBody = useText("retreats.empty.body", "We are quietly putting together the next round of corporate retreats. In the meantime, please reach out and we will design something around your team.");

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/api/retreats`).then(({ data }) => {
      if (!cancelled) setItems(Array.isArray(data) ? data : []);
    }).catch(() => { /* fall through to empty state */ }).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div data-testid="retreats-page">
      <Seo
        title="Corporate and Custom Retreats - Once Were Wild Travel"
        description="Fully hosted retreats for teams, families and milestone groups, designed around your people from scratch."
        path="/corporate-retreats"
      />
      <PageHero eyebrow={heroEyebrow} title={heroTitle} intro={heroIntro} />

      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          {loaded && items.length === 0 && (
            <div className="text-center max-w-2xl mx-auto" data-testid="retreats-empty">
              <h2 className="font-display font-light text-ink text-3xl sm:text-4xl mb-4">{emptyHeading}</h2>
              <p className="editorial text-ink-soft mb-8">{emptyBody}</p>
              <CTAButton to="/contact" variant="filled" withArrow>{enquireLabel}</CTAButton>
            </div>
          )}

          {items.length > 0 && (
            <div className="grid gap-7 lg:grid-cols-3 items-stretch">
              {items.map((r, i) => {
                const includes = Array.isArray(r.includes) ? r.includes : [];
                return (
                  <ScrollReveal key={r.id} delay={i * 110}>
                    <div
                      className="relative h-full flex flex-col rounded-sm p-8 sm:p-9 bg-white border border-nature-deep/10 shadow-lg transition-all duration-500 hover:-translate-y-2"
                      data-testid={`retreat-card-${r.slug || r.id}`}
                    >
                      <p className="label-eyebrow text-nature-mid mb-3">{r.region}</p>
                      <h3 className="font-display font-light text-ink text-3xl leading-tight mb-1">{r.name}</h3>
                      <p className="text-ink-soft text-sm mb-6 editorial">{r.summary}</p>

                      {r.priceFrom && (
                        <div className="mb-1">
                          <span className="font-display font-light text-nature-deep text-4xl sm:text-5xl">{r.priceFrom}</span>
                        </div>
                      )}
                      {r.priceUnit && <p className="text-ink-soft text-sm">{r.priceUnit}</p>}
                      {r.priceNote && <p className="text-ink-soft/80 text-xs mt-1 mb-6">{r.priceNote}</p>}

                      {(r.nights || r.dates) && (
                        <div className="flex items-center gap-2 text-xs text-ink-soft mb-6 font-accent uppercase tracking-label">
                          {r.nights && <span>{r.nights}</span>}
                          {r.nights && r.dates && <span className="text-gold">•</span>}
                          {r.dates && <span>{r.dates}</span>}
                        </div>
                      )}

                      {includes.length > 0 && (
                        <ul className="space-y-3 mb-9 flex-1">
                          {includes.map((inc) => (
                            <li key={inc} className="flex items-start gap-3 text-ink/85">
                              <Check className="h-4 w-4 mt-1 text-nature-mid shrink-0" />
                              <span className="text-sm">{inc}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <CTAButton to="/contact" variant="gold" withArrow className="w-full">
                        {r.cta || enquireLabel}
                      </CTAButton>

                      {r.slug && (
                        <Link
                          to={`/corporate-retreats/${r.slug}`}
                          className="mt-3 inline-flex items-center justify-center gap-2 text-xs font-accent uppercase tracking-label text-nature-deep hover:text-gold transition-colors duration-200 group"
                          data-testid={`retreat-find-out-more-${r.slug}`}
                        >
                          <span>Find Out More</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      )}
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
