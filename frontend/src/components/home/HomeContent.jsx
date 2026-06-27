import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useText, useRichText } from "@/context/ContentContext";

// Long-form rich-text content sections shown on the home page. Each section
// renders an editable H2 + HTML body (TipTap output). Auto-hides if no
// visible sections so the page never shows an empty area.
export function HomeContent() {
  const eyebrow = useText("home.content.eyebrow", "More to know");
  const title = useRichText("home.content.title", "Slow stories, *gently shared.*");

  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get("/home-sections").then(({ data }) => {
      if (alive) setItems(Array.isArray(data) ? data : []);
    }).catch(() => {
      if (alive) setItems([]);
    });
    return () => { alive = false; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="bg-cream py-24 sm:py-28" data-testid="home-content-sections">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        {eyebrow && (
          <ScrollReveal>
            <p className="label-eyebrow text-nature-mid mb-5 text-center">{eyebrow}</p>
          </ScrollReveal>
        )}
        {title && (
          <ScrollReveal delay={80}>
            <h2 className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight text-center mb-14">
              {title}
            </h2>
          </ScrollReveal>
        )}
        <div className="space-y-14">
          {items.map((s, i) => (
            <ScrollReveal key={s.id || i} delay={120 + i * 60}>
              <article data-testid={`home-section-${i}`}>
                {s.heading && (
                  <h3 className="font-display text-2xl sm:text-3xl font-light text-ink leading-tight tracking-tight mb-4">
                    {s.heading}
                  </h3>
                )}
                <div
                  className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg editorial"
                  dangerouslySetInnerHTML={{ __html: s.body || "" }}
                />
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeContent;
