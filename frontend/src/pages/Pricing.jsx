import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ChevronRight } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { JOURNEYS, PRICING_FINE_PRINT, FAQS } from "@/data/content";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useText, useContent, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { FadeImg } from "@/components/ui/FadeImg";
import { Seo } from "@/components/seo/Seo";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Helper - prefix any /api/uploads/... path with the backend origin so the
// page works on the deployed CDN. Already-absolute URLs pass through.
const abs = (u) => (u && API_BASE && u.startsWith("/") ? `${API_BASE}${u}` : u);
const absMap = (m) => {
  if (!m || typeof m !== "object") return null;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, abs(v)]));
};

export default function Pricing() {
  const { content } = useContent();
  const [adminJourneys, setAdminJourneys] = useState(null);
  const [mediaMap, setMediaMap] = useState({});

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

  // Pull the full media list so we can resolve each journey's hero_media_id
  // to a proper srcset / lqip / fallback url. Browser caches the result.
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/api/media`).then(({ data }) => {
      if (cancelled) return;
      const map = {};
      (data || []).forEach((m) => { map[m.id] = m; });
      setMediaMap(map);
    }).catch(() => { /* missing media handled per-card */ });
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
    // Resolve hero image from the media collection (admin-uploaded). Falls
    // back to the legacy hardcoded `image` prop on JOURNEYS so the page
    // never renders an empty card frame.
    const heroMedia = j.hero_media_id ? mediaMap[j.hero_media_id] : null;
    const heroUrl = heroMedia ? abs(heroMedia.file_url) : (j.image || "");
    const heroSrcset = heroMedia ? absMap(heroMedia.srcset) : null;
    const heroAvif = heroMedia ? absMap(heroMedia.avif_srcset) : null;
    const heroLqip = heroMedia ? (heroMedia.lqip || "") : "";
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
      heroUrl, heroSrcset, heroAvif, heroLqip,
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

      {/* Z1 — clean 3-col tour-card grid (image-on-top + gold name banner).
          Matches the layout the client filed via WhatsApp (the
          arrivederciPuglia reference) while staying in the Once Were Wild
          gold + cream + ink palette. Whole card is one clickable link to
          /tours/<slug> for fast scanning. */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {journeys.map((j, i) => {
              const href = j.urlSlug ? `/tours/${j.urlSlug}` : "/contact";
              return (
                <ScrollReveal key={j.id || j.urlSlug || i} delay={i * 90}>
                  <Link
                    to={href}
                    className="group block bg-white rounded-sm overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                    data-testid={`pricing-card-${j.id || j.urlSlug || i}`}
                    aria-label={`View ${j.name}`}
                  >
                    {/* Photo */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-nature-deep/5">
                      {j.heroUrl ? (
                        <FadeImg
                          src={j.heroUrl}
                          srcset={j.heroSrcset || undefined}
                          avifSrcset={j.heroAvif || undefined}
                          alt={j.name}
                          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                          loading={i < 3 ? "eager" : "lazy"}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-nature-deep/15 to-gold/10 flex items-center justify-center">
                          <span className="font-display font-light text-ink/30 text-3xl">{j.name?.[0] || "O"}</span>
                        </div>
                      )}
                      {j.popular && (
                        <span className="absolute top-3 left-3 rounded-full bg-gold/95 backdrop-blur-sm px-3 py-1 font-accent text-[10px] uppercase tracking-label text-ink shadow-md">
                          {popularLabel}
                        </span>
                      )}
                    </div>
                    {/* Gold name banner with chevron - the signature of the
                        client's reference layout, recoloured to our gold. */}
                    <div className="flex items-center justify-between gap-3 bg-gold px-5 py-4 transition-colors duration-300 group-hover:bg-nature-deep">
                      <div className="min-w-0">
                        {j.region && (
                          <span className="block label-eyebrow text-ink/60 group-hover:text-cream/70 transition-colors duration-300 text-[10px] mb-0.5 truncate">
                            {j.region}
                          </span>
                        )}
                        <h3 className="font-display font-light text-ink group-hover:text-cream text-lg sm:text-xl leading-tight tracking-tight truncate transition-colors duration-300">
                          {j.name}
                        </h3>
                      </div>
                      <ChevronRight className="h-5 w-5 text-ink group-hover:text-cream shrink-0 transition-all duration-300 group-hover:translate-x-1" />
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
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
