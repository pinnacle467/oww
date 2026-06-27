import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useText, useRichText } from "@/context/ContentContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// "Questions Gently Answered" - home page FAQ accordion. The heading wording
// is editable in Admin -> Website Text but defaults to the exact copy the
// client signed off on. The whole section auto-hides if there are zero
// visible FAQs so the page never shows an empty accordion.
export function QuestionsAnswered() {
  const eyebrow = useText("home.faq.eyebrow", "Common Questions");
  const heading = useText("home.faq.heading", "Questions Gently Answered");
  const intro = useText(
    "home.faq.intro",
    "Quiet answers to the things most often asked before stepping into a journey with us."
  );

  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get("/home-faqs").then(({ data }) => {
      if (alive) setItems(Array.isArray(data) ? data : []);
    }).catch(() => {
      if (alive) setItems([]);
    });
    return () => { alive = false; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="bg-white py-24 sm:py-28" data-testid="home-faq">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <ScrollReveal>
          <p className="label-eyebrow text-nature-mid mb-5 text-center">{eyebrow}</p>
        </ScrollReveal>
        <ScrollReveal delay={80}>
          <h2 className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight text-center mb-6">
            {heading}
          </h2>
        </ScrollReveal>
        {intro && (
          <ScrollReveal delay={140}>
            <p className="editorial text-ink-soft text-lg text-center max-w-2xl mx-auto mb-12">
              {intro}
            </p>
          </ScrollReveal>
        )}
        <ScrollReveal delay={200}>
          <Accordion type="single" collapsible className="w-full" data-testid="home-faq-accordion">
            {items.map((f, i) => (
              <AccordionItem
                key={f.id || i}
                value={`home-faq-${f.id || i}`}
                className="border-b border-nature-deep/12"
              >
                <AccordionTrigger
                  className="text-left font-display text-xl sm:text-2xl font-light text-ink hover:no-underline hover:text-nature-mid py-6"
                  data-testid={`home-faq-trigger-${i}`}
                >
                  {f.question}
                </AccordionTrigger>
                <AccordionContent
                  className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg pb-6"
                  data-testid={`home-faq-content-${i}`}
                >
                  <div dangerouslySetInnerHTML={{ __html: f.answer || "" }} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default QuestionsAnswered;
