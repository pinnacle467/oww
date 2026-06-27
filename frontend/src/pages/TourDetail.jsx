import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Download, ArrowRight, MapPin, Calendar, Clock } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { Seo } from "@/components/seo/Seo";
import { useText } from "@/context/ContentContext";
import { TourGallery } from "@/components/tour/TourGallery";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

// Single component renders both /tours/<slug> (tours) and
// /corporate-retreats/<slug> (retreats). The only difference between the
// two routes is the API endpoint, the back-link, and the breadcrumb copy.
export default function TourDetail() {
  const { slug } = useParams();
  const location = useLocation();
  const [tour, setTour] = useState(null);
  const [media, setMedia] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ok | not-found
  const enquireLabel = useText("tours.detail.enquire", "Enquire Now");

  // Detect which "kind" of journey this is from the URL. Retreats live
  // under /corporate-retreats/* so we hit a different API endpoint and
  // adjust the breadcrumb / back-link accordingly.
  const isRetreat = location.pathname.startsWith("/corporate-retreats");
  const kind = isRetreat ? "retreat" : "tour";
  const apiPath = isRetreat ? "retreats" : "tours";
  const backLinkTo = isRetreat ? "/corporate-retreats" : "/pricing";
  const backLinkLabel = isRetreat ? "View all retreats" : "View all tours";
  const seoPath = isRetreat ? `/corporate-retreats/${slug}` : `/tours/${slug}`;

  // Optional ?preview=<token> query param lets the admin preview drafts
  // without publishing them. Backend validates the token against the row.
  const previewToken = new URLSearchParams(location.search).get("preview") || "";

  useEffect(() => {
    setStatus("loading");
    const qs = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : "";
    axios
      .get(`${API_BASE}/api/${apiPath}/${slug}${qs}`)
      .then(({ data }) => { setTour(data); setStatus("ok"); })
      .catch(() => setStatus("not-found"));
  }, [slug, apiPath, previewToken]);

  // Pull the full media list once so we can resolve hero + gallery ids
  // to proper srcset urls. Browser caches the result.
  useEffect(() => {
    axios.get(`${API_BASE}/api/media`).then(({ data }) => {
      const map = {};
      (data || []).forEach((m) => { map[m.id] = m; });
      setMedia(map);
    }).catch(() => {});
  }, []);

  const absolutise = useMemo(() => {
    const base = process.env.REACT_APP_BACKEND_URL || "";
    return (urlMap) => {
      if (!urlMap || typeof urlMap !== "object") return null;
      return Object.fromEntries(Object.entries(urlMap).map(([k, v]) => [k, base && v ? `${base}${v}` : v]));
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream" data-testid="tour-detail-loading">
        <p className="text-ink-soft text-sm">Loading...</p>
      </div>
    );
  }

  if (status === "not-found" || !tour) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6" data-testid="tour-detail-not-found">
        <h1 className="font-display font-light text-ink text-4xl mb-4">
          {isRetreat ? "Retreat not found" : "Tour not found"}
        </h1>
        <p className="text-ink-soft mb-8 text-center max-w-md">
          {isRetreat
            ? "This retreat may have been moved or is no longer published."
            : "This tour may have been moved or is no longer published. View our current journeys instead."}
        </p>
        <CTAButton to={backLinkTo} variant="filled" withArrow>{backLinkLabel}</CTAButton>
      </div>
    );
  }

  const hero = tour.hero_media_id ? media[tour.hero_media_id] : null;
  const heroUrl = hero ? (process.env.REACT_APP_BACKEND_URL ? `${API_BASE}${hero.file_url}` : hero.file_url) : null;
  const heroSrcset = hero ? absolutise(hero.srcset) : null;
  const heroLqip = hero ? (hero.lqip || "") : "";
  const seoTitle = (tour.seo_title || `${tour.name} - Once Were Wild Travel`).trim();
  const seoDesc = (tour.seo_description || tour.summary || "").trim();

  // B2 body fields - prefer the new split fields; fall back to legacy body_html.
  const descriptionHtml = tour.description_html || tour.body_html || "";
  const itineraryHtml = tour.itinerary_html || "";
  const practicalHtml = tour.practical_html || "";
  const hasBody = !!(descriptionHtml || itineraryHtml || practicalHtml);
  const galleryIds = Array.isArray(tour.gallery_media_ids) ? tour.gallery_media_ids : [];

  return (
    <article data-testid="tour-detail-page" data-kind={kind}>
      <Seo
        title={seoTitle}
        description={seoDesc}
        path={seoPath}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          "name": tour.name,
          "description": seoDesc,
          "url": `https://oncewerewild.com${seoPath}`,
        }}
      />

      {/* Preview ribbon - only visible when viewing a draft via preview token */}
      {tour.status === "draft" && (
        <div className="bg-gold/90 text-ink text-center py-2 text-xs font-accent uppercase tracking-label" data-testid="tour-preview-ribbon">
          Preview mode - this {kind} is currently a draft and not visible to the public.
        </div>
      )}

      <PageHero
        eyebrow={tour.region || "Once Were Wild Travel"}
        title={tour.name}
        intro={tour.summary || ""}
        image={heroUrl || ""}
        lqip={heroLqip}
        srcset={heroSrcset}
      />

      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          {(tour.nights || tour.dates || tour.region) && (
            <ScrollReveal>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mb-12 pb-12 border-b border-nature-deep/10" data-testid="tour-key-details">
                {tour.nights && (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Clock className="h-4 w-4 text-gold" />
                    <span className="font-accent text-sm uppercase tracking-label">{tour.nights}</span>
                  </div>
                )}
                {tour.region && (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <MapPin className="h-4 w-4 text-gold" />
                    <span className="font-accent text-sm uppercase tracking-label">{tour.region}</span>
                  </div>
                )}
                {tour.dates && (
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Calendar className="h-4 w-4 text-gold" />
                    <span className="font-accent text-sm uppercase tracking-label">{tour.dates}</span>
                  </div>
                )}
              </div>
            </ScrollReveal>
          )}

          {hasBody ? (
            <div className="space-y-12">
              {descriptionHtml && (
                <ScrollReveal delay={120}>
                  <div data-testid="tour-section-description">
                    <h3 className="font-display font-light text-ink text-2xl sm:text-3xl mb-5">About this journey</h3>
                    <div
                      className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg editorial"
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  </div>
                </ScrollReveal>
              )}
              {itineraryHtml && (
                <ScrollReveal delay={140}>
                  <div data-testid="tour-section-itinerary" className="pt-12 border-t border-nature-deep/10">
                    <h3 className="font-display font-light text-ink text-2xl sm:text-3xl mb-5">Itinerary</h3>
                    <div
                      className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg editorial"
                      dangerouslySetInnerHTML={{ __html: itineraryHtml }}
                    />
                  </div>
                </ScrollReveal>
              )}
              {practicalHtml && (
                <ScrollReveal delay={160}>
                  <div data-testid="tour-section-practical" className="pt-12 border-t border-nature-deep/10">
                    <h3 className="font-display font-light text-ink text-2xl sm:text-3xl mb-5">Practical information</h3>
                    <div
                      className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg editorial"
                      dangerouslySetInnerHTML={{ __html: practicalHtml }}
                    />
                  </div>
                </ScrollReveal>
              )}
            </div>
          ) : (
            tour.summary && (
              <ScrollReveal delay={120}>
                <p className="editorial text-ink-soft text-lg leading-relaxed text-center max-w-2xl mx-auto">
                  {tour.summary}
                </p>
              </ScrollReveal>
            )
          )}

          {tour.priceFrom && (
            <ScrollReveal delay={180}>
              <div className="mt-14 pt-12 border-t border-nature-deep/10 text-center">
                <p className="label-eyebrow text-nature-mid mb-3">Investment</p>
                <span className="font-display font-light text-nature-deep text-5xl sm:text-6xl">{tour.priceFrom}</span>
                {tour.priceUnit && <p className="text-ink-soft text-sm mt-2">{tour.priceUnit}</p>}
                {tour.priceNote && <p className="text-ink-soft/80 text-xs mt-1">{tour.priceNote}</p>}
              </div>
            </ScrollReveal>
          )}

          <ScrollReveal delay={220}>
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
              <CTAButton to="/contact" variant="filled" withArrow data-testid="tour-enquire">
                {enquireLabel}
              </CTAButton>
              {tour.itinerary_url && (
                <a
                  href={tour.itinerary_url}
                  download={tour.itinerary_filename || "itinerary.pdf"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-7 py-3 border border-nature-deep/30 rounded-full font-accent text-sm uppercase tracking-label text-ink hover:bg-nature-deep hover:text-cream transition-colors duration-200"
                  data-testid="tour-download-pdf"
                >
                  <Download className="h-4 w-4" />
                  Download Itinerary (PDF)
                </a>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Gallery (only renders when there are media ids set) */}
      {galleryIds.length > 0 && (
        <TourGallery
          mediaIds={galleryIds}
          mediaMap={media}
          eyebrow="Journey gallery"
          heading="Moments along the way"
        />
      )}

      <section className="bg-white pb-20">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <ScrollReveal delay={240}>
            <div className="pt-8 border-t border-nature-deep/10 text-center">
              <Link to={backLinkTo} className="inline-flex items-center gap-2 text-sm font-accent uppercase tracking-label text-ink-soft hover:text-nature-deep transition-colors duration-200">
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                <span>{backLinkLabel}</span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </article>
  );
}
