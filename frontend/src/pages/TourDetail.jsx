import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Download, ArrowRight, MapPin, Calendar, Clock } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { Seo } from "@/components/seo/Seo";
import { useText } from "@/context/ContentContext";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

// Individual tour sub-page rendered at /tours/<slug>. Built on top of the
// existing /api/tours/<slug> endpoint which 404s on draft/inactive rows.
export default function TourDetail() {
  const { slug } = useParams();
  const [tour, setTour] = useState(null);
  const [media, setMedia] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ok | not-found
  const enquireLabel = useText("tours.detail.enquire", "Enquire Now");

  useEffect(() => {
    setStatus("loading");
    axios
      .get(`${API_BASE}/api/tours/${slug}`)
      .then(({ data }) => { setTour(data); setStatus("ok"); })
      .catch(() => setStatus("not-found"));
  }, [slug]);

  // Pull the full media list once so we can resolve `hero_media_id` to a
  // proper srcset. Cheap (cached browser-side).
  useEffect(() => {
    axios.get(`${API_BASE}/api/media`).then(({ data }) => {
      const map = {};
      (data || []).forEach((m) => { map[m.id] = m; });
      setMedia(map);
    }).catch(() => {});
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
        <h1 className="font-display font-light text-ink text-4xl mb-4">Tour not found</h1>
        <p className="text-ink-soft mb-8 text-center max-w-md">
          This tour may have been moved or is no longer published. View our current journeys instead.
        </p>
        <CTAButton to="/pricing" variant="filled" withArrow>View all tours</CTAButton>
      </div>
    );
  }

  const hero = tour.hero_media_id ? media[tour.hero_media_id] : null;
  const heroUrl = hero ? (process.env.REACT_APP_BACKEND_URL ? `${API_BASE}${hero.file_url}` : hero.file_url) : null;
  // Map relative /api/uploads URLs in srcset to absolute when REACT_APP_BACKEND_URL is set,
  // so the <img srcset> works on the deployed site behind a CDN.
  const absolutise = (urlMap) => {
    if (!urlMap || typeof urlMap !== "object") return null;
    const base = process.env.REACT_APP_BACKEND_URL || "";
    return Object.fromEntries(Object.entries(urlMap).map(([k, v]) => [k, base && v ? `${base}${v}` : v]));
  };
  const heroSrcset = hero ? absolutise(hero.srcset) : null;
  const heroLqip = hero ? (hero.lqip || "") : "";
  const seoTitle = (tour.seo_title || `${tour.name} - Once Were Wild Travel`).trim();
  const seoDesc = (tour.seo_description || tour.summary || "").trim();

  return (
    <article data-testid="tour-detail-page">
      <Seo
        title={seoTitle}
        description={seoDesc}
        path={`/tours/${tour.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          "name": tour.name,
          "description": seoDesc,
          "url": `https://oncewerewild.com/tours/${tour.slug}`,
        }}
      />

      <PageHero
        eyebrow={tour.region || "Once Were Wild Travel"}
        title={tour.name}
        intro={tour.summary || ""}
        image={heroUrl || ""}
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

          {tour.body_html ? (
            <ScrollReveal delay={120}>
              <div
                className="prose prose-neutral max-w-none text-ink-soft text-base sm:text-lg editorial"
                dangerouslySetInnerHTML={{ __html: tour.body_html }}
                data-testid="tour-body"
              />
            </ScrollReveal>
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
            <ScrollReveal delay={160}>
              <div className="mt-14 pt-12 border-t border-nature-deep/10 text-center">
                <p className="label-eyebrow text-nature-mid mb-3">Investment</p>
                <span className="font-display font-light text-nature-deep text-5xl sm:text-6xl">{tour.priceFrom}</span>
                {tour.priceUnit && <p className="text-ink-soft text-sm mt-2">{tour.priceUnit}</p>}
                {tour.priceNote && <p className="text-ink-soft/80 text-xs mt-1">{tour.priceNote}</p>}
              </div>
            </ScrollReveal>
          )}

          <ScrollReveal delay={200}>
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

          <ScrollReveal delay={240}>
            <div className="mt-16 pt-8 border-t border-nature-deep/10 text-center">
              <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-accent uppercase tracking-label text-ink-soft hover:text-nature-deep transition-colors duration-200">
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                <span>View all tours</span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </article>
  );
}
