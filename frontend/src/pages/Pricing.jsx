import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Check, Download, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { JOURNEYS, PRICING_FINE_PRINT, FAQS } from "@/data/content";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useText, useContent, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { Seo } from "@/components/seo/Seo";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

export default function Pricing() {
  const { content } = useContent();
  const [adminJourneys, setAdminJourneys] = useState(null);

  // Fetch the admin-managed journey list. While the request is in flight (or
  // if it fails), fall back to the hardcoded JOURNEYS in /data/content.js so
  // the page always renders something. The legacy editable content keys
  // (journeys.${id}.name, etc) are still honoured for the seeded 3 so
  // existing edits aren't lost during the migration.
  // B2: filter to type=tour so retreats (e.g. Maleny) appear on
  // /corporate-retreats instead of double-billing on /pricing.
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/api/journeys?type=tour`).then((res) => {
      if (!cancelled && Array.isArray(res.data) && res.data.length) {
        setAdminJourneys(res.data);
      }
    }).catch(() => { /* fall back to JOURNEYS */ });
    return () => { cancelled = true; };
  }, []);

  const heroEyebrow = useText("pricing.hero.eyebrow", "Journeys and Investment");
  const heroTitle = useRichText("pricing.hero.title", "Where will you *go next?*");
  const heroIntro = useText("pricing.hero.intro", "Every journey is all inclusive, intimate and thoughtfully paced. Here is what it takes to join us.");
  const popularLabel = useText("pricing.popular_label", "Most Popular");
  const finePrintTitle = useText("pricing.fine_print_title", "The fine print");
  const finePrint = useText("pricing.fine_print", PRICING_FINE_PRINT);
  const faqEyebrow = useText("pricing.faq.eyebrow", "Good to Know");
  const faqTitle = useRichText("pricing.faq.title", "Questions, *gently answered.*");
  const faqFooter = useText("pricing.faq.footer_note", "Still wondering if this is for you? It probably is.");
  const faqCta = useText("pricing.faq.cta", "Book a discovery call");
  const { src: heroImg, lqip: heroLqip, srcset: heroSrcset } = useMediaSlot("pricing-hero", "/assets/images/hero/hero-02.webp");

  // Build journeys list. If the admin has populated the journeys collection
  // (which it does by default — 3 default trips are seeded server-side),
  // use that. Otherwise fall back to the hardcoded JOURNEYS so the page
  // never goes blank if the API is unreachable.
  const journeys = (adminJourneys || JOURNEYS).map((j) => {
    // `contentKey` is the lookup prefix for editable text overrides (uses the
    // row id or legacy slug). `urlSlug` is the new B1 field driving the sub-
    // page URL at /tours/<urlSlug>. Falls back to the row id so the legacy
    // hardcoded JOURNEYS still work even before the backend backfill ran.
    const contentKey = j.id || "";
    const urlSlug = j.slug || j.id || "";
    const includesArr = Array.isArray(j.includes)
      ? j.includes
      : (typeof j.includes === "string" ? j.includes.split("|").map((s) => s.trim()).filter(Boolean) : []);
    return {
      ...j,
      urlSlug,
      name:       content[`journeys.${contentKey}.name`]      || j.name,
      region:     content[`journeys.${contentKey}.region`]    || j.region,
      nights:     content[`journeys.${contentKey}.nights`]    || j.nights,
      dates:      content[`journeys.${contentKey}.dates`]     || j.dates,
      priceFrom:  content[`journeys.${contentKey}.priceFrom`] || j.priceFrom,
      priceUnit:  content[`journeys.${contentKey}.priceUnit`] || j.priceUnit,
      priceNote:  content[`journeys.${contentKey}.priceNote`] || j.priceNote,
      summary:    content[`journeys.${contentKey}.summary`]   || j.summary,
      cta:        content[`journeys.${contentKey}.cta`]       || j.cta,
      includes:  (content[`journeys.${contentKey}.includes`]
                    ? content[`journeys.${contentKey}.includes`].split("|").map((s) => s.trim()).filter(Boolean)
                    : includesArr),
      itineraryUrl: j.itinerary_url || j.itineraryUrl || "",
      itineraryFilename: j.itinerary_filename || j.itineraryFilename || "",
    };
  });

  const faqs = FAQS.map((f, i) => ({
    q: content[`faqs.${i}.q`] || f.q,
    a: content[`faqs.${i}.a`] || f.a,
  }));

  return (
    <div data-testid="pricing-page">
      <Seo
        page="pricing"
        path="/pricing"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://oncewerewild.com/" },
                { "@type": "ListItem", "position": 2, "name": "Journeys and pricing", "item": "https://oncewerewild.com/pricing" },
              ],
            },
            ...journeys.map((j) => ({
              "@type": "TouristTrip",
              "@id": `https://oncewerewild.com/pricing#${j.id}`,
              "name": j.name,
              "description": j.summary,
              "touristType": "Women, 45+",
              "itinerary": { "@type": "ItemList", "numberOfItems": j.includes.length,
                              "itemListElement": j.includes.map((inc, i) => ({
                                "@type": "ListItem", "position": i + 1, "name": inc })) },
              "offers": {
                "@type": "Offer",
                "price": j.priceFrom,
                "priceCurrency": "AUD",
                "availability": "https://schema.org/InStock",
                "url": "https://oncewerewild.com/contact",
                "description": `${j.priceUnit}. ${j.priceNote}`,
              },
              "provider": { "@id": "https://oncewerewild.com/#organization" },
            })),
            {
              "@type": "FAQPage",
              "@id": "https://oncewerewild.com/pricing#faqs",
              "mainEntity": faqs.map((f) => ({
                "@type": "Question",
                "name": f.q,
                "acceptedAnswer": { "@type": "Answer", "text": f.a },
              })),
            },
          ],
        }}
      />
      <PageHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        intro={heroIntro}
        image={heroImg}
        lqip={heroLqip}
      />

      {/* Tier cards */}
      <section className="bg-cream py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-7 lg:grid-cols-3 items-stretch">
            {journeys.map((j, i) => (
              <ScrollReveal key={j.id} delay={i * 110}>
                <div
                  className={cn(
                    "relative h-full flex flex-col rounded-sm p-8 sm:p-9 bg-white transition-all duration-500 hover:-translate-y-2",
                    j.popular ? "border-2 border-gold shadow-2xl lg:-mt-4 lg:mb-4" : "border border-nature-deep/10 shadow-lg"
                  )}
                  data-testid={`pricing-card-${j.id}`}
                >
                  {j.popular && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold px-5 py-1.5 font-accent text-[10px] uppercase tracking-label text-ink">
                      {popularLabel}
                    </span>
                  )}
                  <p className="label-eyebrow text-nature-mid mb-3">{j.region}</p>
                  <h3 className="font-display font-light text-ink text-3xl leading-tight mb-1">{j.name}</h3>
                  <p className="text-ink-soft text-sm mb-6 editorial">{j.summary}</p>

                  <div className="mb-1">
                    <span className="font-display font-light text-nature-deep text-4xl sm:text-5xl">{j.priceFrom}</span>
                  </div>
                  <p className="text-ink-soft text-sm">{j.priceUnit}</p>
                  <p className="text-ink-soft/80 text-xs mt-1 mb-6">{j.priceNote}</p>

                  <div className="flex items-center gap-2 text-xs text-ink-soft mb-6 font-accent uppercase tracking-label">
                    <span>{j.nights}</span><span className="text-gold">•</span><span>{j.dates}</span>
                  </div>

                  <ul className="space-y-3 mb-9 flex-1">
                    {j.includes.map((inc) => (
                      <li key={inc} className="flex items-start gap-3 text-ink/85">
                        <Check className="h-4 w-4 mt-1 text-nature-mid shrink-0" />
                        <span className="text-sm">{inc}</span>
                      </li>
                    ))}
                  </ul>

                  <CTAButton to="/contact" variant={j.popular ? "filled" : "gold"} withArrow className="w-full" data-testid={`pricing-cta-${j.id}`}>
                    {j.cta}
                  </CTAButton>

                  {/* B1 sub-page link - opens /tours/<slug>. Only renders when
                      the journey has a URL slug (i.e. came from the admin API
                      with the B1 backfill applied). Quiet, no chrome. */}
                  {j.urlSlug && (
                    <Link
                      to={`/tours/${j.urlSlug}`}
                      className="mt-3 inline-flex items-center justify-center gap-2 text-xs font-accent uppercase tracking-label text-nature-deep hover:text-gold transition-colors duration-200 group"
                      data-testid={`pricing-find-out-more-${j.id}`}
                    >
                      <span>Find Out More</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}

                  {/* Quiet secondary CTA — only renders when the admin has
                      uploaded a PDF itinerary for this journey. Stays out
                      of the main CTA's way visually. */}
                  {j.itineraryUrl && (
                    <a
                      href={j.itineraryUrl}
                      download={j.itineraryFilename || "itinerary.pdf"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-2 text-xs font-accent uppercase tracking-label text-ink-soft hover:text-nature-deep transition-colors duration-200"
                      data-testid={`pricing-itinerary-${j.id}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Itinerary (PDF)
                    </a>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Fine print */}
          <ScrollReveal className="mt-14 max-w-3xl">
            <div className="glass-solid rounded-sm p-7">
              <p className="label-eyebrow text-nature-mid mb-3">{finePrintTitle}</p>
              <p className="editorial text-ink-soft text-sm">{finePrint}</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq-accordion" className="bg-white py-24 sm:py-28 scroll-mt-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <SectionHeading eyebrow={faqEyebrow} title={faqTitle} align="center" className="mb-12" />
          <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b border-nature-deep/12">
                <AccordionTrigger className="text-left font-display text-xl sm:text-2xl font-light text-ink hover:no-underline hover:text-nature-mid py-6" data-testid={`faq-trigger-${i}`}>
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="editorial text-ink-soft text-base pb-6">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="text-center mt-14">
            <p className="editorial text-ink-soft mb-6">{faqFooter}</p>
            <CTAButton to="/contact" variant="filled" withArrow>{faqCta}</CTAButton>
          </div>
        </div>
      </section>
    </div>
  );
}
