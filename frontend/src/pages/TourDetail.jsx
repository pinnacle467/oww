import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Download, ArrowRight, MapPin, Calendar, Clock, Check, X, ChevronLeft } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CTAButton } from "@/components/ui/CTAButton";
import { Seo } from "@/components/seo/Seo";
import { useText, useContent } from "@/context/ContentContext";
import { SwipeableMedia } from "@/components/media/SwipeableMedia";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Helpers - rewrite relative /api/uploads paths to absolute URLs so the
// page works on the deployed CDN.
const abs = (u) => (u && API_BASE && u.startsWith("/") ? `${API_BASE}${u}` : u);
const absMap = (m) => {
  if (!m || typeof m !== "object") return null;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, abs(v)]));
};

// Build an items[] array (in SwipeableMedia shape) from a list of media ids
// + the loaded media map. Items missing from the map are silently dropped.
function buildMediaItems(ids, mediaMap) {
  return (ids || [])
    .map((id) => mediaMap[id])
    .filter(Boolean)
    .map((m) => {
      const kind = m.file_type === "video" ? "video"
        : m.file_type === "embed" ? "embed"
        : "image";
      return {
        id: m.id,
        kind,
        url: abs(m.file_url),
        srcset: kind === "image" ? absMap(m.srcset) : null,
        avif_srcset: kind === "image" ? absMap(m.avif_srcset) : null,
        lqip: m.lqip || null,
        alt: m.alt_text || m.caption || m.alt || "",
        caption: m.caption || "",
        embed_provider: m.embed_provider || null,
        embed_id: m.embed_id || null,
      };
    });
}

// Z1 — Single component renders both /tours/<slug> (tours) and
// /corporate-retreats/<slug> (retreats). The two-column layout (main +
// sticky sidebar) matches the client-supplied reference: title, hero
// carousel, italic description, tab strip with DETAILS / GALLERY /
// WHAT'S INCLUDED / PRICES & DATES on the left; tour highlights,
// small-group blurb and testimonials on the right.
export default function TourDetail() {
  const { slug } = useParams();
  const location = useLocation();
  const { content } = useContent();
  const [tour, setTour] = useState(null);
  const [mediaMap, setMediaMap] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ok | not-found
  const [activeTab, setActiveTab] = useState("details");
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

  // Sidebar copy is admin-editable via /admin/website-text (group inferred
  // from key prefix - shows up under "Tour detail").
  const highlightsHeading = useText("tour_detail.highlights.heading", "Tour highlights");
  const smallGroupHeading = useText("tour_detail.small_group.heading", "Small group tours");
  const smallGroupBody    = useText(
    "tour_detail.small_group.body",
    "For a more private experience and a better quality of service, our small groups are limited to twelve travellers."
  );
  const testimonialsHeading = useText("tour_detail.testimonials.heading", "Testimonials");
  const detailsLabel  = useText("tour_detail.tab.details", "Details");
  const includesLabel = useText("tour_detail.tab.includes", "Inclusions");
  const pricesLabel   = useText("tour_detail.tab.prices", "Prices & Dates");
  const downloadLabel = useText("tour_detail.download_pdf", "Download Full Itinerary (PDF)");

  useEffect(() => {
    setStatus("loading");
    setActiveTab("details");
    const qs = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : "";
    axios
      .get(`${API_BASE}/api/${apiPath}/${slug}${qs}`)
      .then(({ data }) => { setTour(data); setStatus("ok"); })
      .catch(() => setStatus("not-found"));
  }, [slug, apiPath, previewToken]);

  // Pull the full media list once so we can resolve hero + gallery ids
  // to proper srcset urls.
  useEffect(() => {
    axios.get(`${API_BASE}/api/media`).then(({ data }) => {
      const map = {};
      (data || []).forEach((m) => { map[m.id] = m; });
      setMediaMap(map);
    }).catch(() => {});
  }, []);

  // AD1 — Hero carousel restored. Builds the list of media items from
  // `gallery_media_ids` (the carousel), falling back to `hero_media_id`
  // when the gallery is empty. Renders nothing when both are empty so a
  // tour with no photos still lays out cleanly.
  const heroItems = useMemo(() => {
    if (!tour) return [];
    const galleryIds = Array.isArray(tour.gallery_media_ids) ? tour.gallery_media_ids : [];
    if (galleryIds.length) return buildMediaItems(galleryIds, mediaMap);
    if (tour.hero_media_id) return buildMediaItems([tour.hero_media_id], mediaMap);
    return [];
  }, [tour, mediaMap]);

  // Site-wide testimonials (already seeded into the home group). We pick
  // the first two non-empty ones for the sidebar card.
  const testimonials = useMemo(() => {
    const out = [];
    for (let i = 0; i < 6 && out.length < 2; i++) {
      const q = (content[`testimonials.${i}.quote`] || "").trim();
      const a = (content[`testimonials.${i}.author`] || "").trim();
      if (q) out.push({ quote: q, author: a });
    }
    return out;
  }, [content]);

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

  const seoTitle = (tour.seo_title || `${tour.name} - Once Were Wild Travel`).trim();
  const seoDesc = (tour.seo_description || tour.summary || "").trim();

  // B2 body fields - prefer the new split fields; fall back to legacy body_html.
  const descriptionHtml = tour.description_html || tour.body_html || "";
  const itineraryHtml = tour.itinerary_html || "";
  const practicalHtml = tour.practical_html || "";
  const moreDetailsHtml = tour.more_details_html || "";
  const includes = Array.isArray(tour.includes) ? tour.includes.filter(Boolean) : [];
  const excludes = Array.isArray(tour.excludes) ? tour.excludes.filter(Boolean) : [];
  const highlights = Array.isArray(tour.highlights) ? tour.highlights.filter(Boolean) : [];

  // Build a tab list, hiding tabs that have no content. Always at least
  // the Details tab is present so the layout never collapses. AD2 — the
  // Gallery tab has been removed; the hero carousel above is the sole
  // place tour photos appear on the page.
  const tabs = [
    { id: "details",  label: detailsLabel,  show: true },
    { id: "includes", label: includesLabel, show: includes.length > 0 || excludes.length > 0 },
    { id: "prices",   label: pricesLabel,   show: !!(tour.priceFrom || tour.dates) },
  ].filter((t) => t.show);

  // Build the sub-line that sits under the H1 (e.g. "7 nights / Small Group Tour - Sunshine Coast").
  const subPieces = [tour.nights, kind === "retreat" ? "Corporate Retreat" : "Small Group Tour"].filter(Boolean);
  const subline = subPieces.join(" - ");

  return (
    <article data-testid="tour-detail-page" data-kind={kind} className="bg-cream/40">
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

      {/* Top bar - back-link */}
      <div className="bg-cream border-b border-nature-deep/10">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            to={backLinkTo}
            className="inline-flex items-center gap-1.5 text-xs font-accent uppercase tracking-label text-ink-soft hover:text-nature-deep transition-colors duration-200"
            data-testid="tour-back-link"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>{backLinkLabel}</span>
          </Link>
          {tour.region && (
            <span className="inline-flex items-center gap-1.5 text-xs font-accent uppercase tracking-label text-ink-soft">
              <MapPin className="h-3.5 w-3.5 text-gold" />
              {tour.region}
            </span>
          )}
        </div>
      </div>

      {/* MAIN 2-COL LAYOUT */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 grid gap-10 lg:gap-12 lg:grid-cols-3">
          {/* ============ LEFT: MAIN ============ */}
          <div className="lg:col-span-2 min-w-0">
            <ScrollReveal>
              <h1 className="font-display font-light text-ink text-4xl sm:text-5xl leading-tight tracking-tight">
                {tour.name}
              </h1>
              {subline && (
                <p className="mt-2 font-display font-light text-ink-soft text-xl sm:text-2xl">
                  {subline}
                </p>
              )}
            </ScrollReveal>

            {/* AD1 — Hero carousel. The full gallery_media_ids list is
                swipeable on touch + has arrows on desktop. The Gallery tab
                has been removed (AD2) so this is the sole place tour
                photos appear on the page. Mobile spacing (mt-6 sm:mt-7)
                gives breathing room between the title/subtitle and the
                carousel; the italic description quote below gets extra
                top margin on phones. */}
            {heroItems.length > 0 && (
              <ScrollReveal delay={100}>
                <div className="mt-6 sm:mt-7 rounded-sm overflow-hidden shadow-lg bg-white" data-testid="tour-hero-carousel">
                  <SwipeableMedia items={heroItems} aspectRatio="16/9" />
                </div>
              </ScrollReveal>
            )}

            {/* Italic quote-style description - matches the client's reference
                where a short blurb sits between the hero and the tab strip. */}
            {(descriptionHtml || tour.summary) && (
              <ScrollReveal delay={140}>
                <div className="mt-6 sm:mt-8 border-l-2 border-gold pl-6 py-2" data-testid="tour-quote">
                  {descriptionHtml ? (
                    <div
                      className="prose prose-neutral max-w-none editorial italic text-ink-soft text-base sm:text-lg leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  ) : (
                    <p className="editorial italic text-ink-soft text-base sm:text-lg leading-relaxed">{tour.summary}</p>
                  )}
                </div>
              </ScrollReveal>
            )}

            {/* TAB STRIP - the signature visual element from the reference.
                Active tab gets a gold fill with a little down-pointing tail.
                Keeps all four tabs on a single row (horizontal scroll on
                very narrow mobiles) and adds a touch of horizontal padding
                so the strip doesn't sit flush against the column edges. */}
            <ScrollReveal delay={180}>
              <div className="mt-10 border-b border-nature-deep/15 px-2 sm:px-4" role="tablist" aria-label="Tour information">
                <div className="flex flex-nowrap items-stretch gap-1 sm:gap-2 -mb-px overflow-x-auto no-scrollbar">
                  {tabs.map((t) => {
                    const isActive = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`tour-tab-panel-${t.id}`}
                        id={`tour-tab-${t.id}`}
                        onClick={() => setActiveTab(t.id)}
                        className={
                          "relative -mb-px px-3 sm:px-5 py-3 font-accent text-[10px] sm:text-xs uppercase tracking-label whitespace-nowrap transition-colors duration-200 flex items-center justify-center min-w-0 " +
                          (isActive
                            ? "bg-gold text-ink"
                            : "text-ink-soft hover:text-nature-deep")
                        }
                        data-testid={`tour-tab-${t.id}`}
                      >
                        <span>{t.label}</span>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-2.5 h-2.5 rotate-45 bg-gold"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>

            {/* TAB PANELS */}
            <div className="mt-8">
              {/* DETAILS - itinerary outline + more-details + PDF button.
                  Per client direction: full day-by-day stays in the PDF; on
                  the page we render an OUTLINE only via itinerary_html /
                  more_details_html. */}
              {activeTab === "details" && (
                <ScrollReveal>
                  <div
                    id="tour-tab-panel-details"
                    role="tabpanel"
                    aria-labelledby="tour-tab-details"
                    data-testid="tour-tab-panel-details"
                    className="space-y-8"
                  >
                    {itineraryHtml ? (
                      <div>
                        <h3 className="font-display font-light text-ink text-2xl sm:text-3xl mb-4">Itinerary</h3>
                        <div
                          className="prose prose-neutral max-w-none editorial text-ink-soft text-base sm:text-lg"
                          dangerouslySetInnerHTML={{ __html: itineraryHtml }}
                        />
                      </div>
                    ) : (
                      // Friendly empty state if the operator hasn't authored
                      // an outline yet - we still show the PDF link below
                      // if they have one uploaded.
                      tour.itinerary_url && (
                        <p className="editorial text-ink-soft italic">
                          A full day-by-day itinerary is available in the PDF below.
                        </p>
                      )
                    )}
                    {moreDetailsHtml && (
                      <div className={itineraryHtml ? "pt-8 border-t border-nature-deep/10" : ""}>
                        <h3 className="font-display font-light text-ink text-2xl sm:text-3xl mb-4">More Details</h3>
                        <div
                          className="prose prose-neutral max-w-none editorial text-ink-soft text-base sm:text-lg"
                          dangerouslySetInnerHTML={{ __html: moreDetailsHtml }}
                        />
                      </div>
                    )}
                    {practicalHtml && (
                      <div className={(itineraryHtml || moreDetailsHtml) ? "pt-8 border-t border-nature-deep/10" : ""}>
                        <h3 className="font-display font-light text-ink text-2xl sm:text-3xl mb-4">Practical information</h3>
                        <div
                          className="prose prose-neutral max-w-none editorial text-ink-soft text-base sm:text-lg"
                          dangerouslySetInnerHTML={{ __html: practicalHtml }}
                        />
                      </div>
                    )}
                    {tour.itinerary_url && (
                      <div className="pt-2">
                        <a
                          href={tour.itinerary_url}
                          download={tour.itinerary_filename || "itinerary.pdf"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-nature-deep text-cream font-accent text-xs sm:text-sm uppercase tracking-label hover:bg-ink transition-colors duration-200 shadow-md"
                          data-testid="tour-download-pdf"
                        >
                          <Download className="h-4 w-4" />
                          {downloadLabel}
                        </a>
                      </div>
                    )}
                    {!itineraryHtml && !moreDetailsHtml && !practicalHtml && !tour.itinerary_url && (
                      <p className="editorial text-ink-soft italic">
                        Full itinerary coming soon. Enquire below and we'll send you the day-by-day plan.
                      </p>
                    )}
                  </div>
                </ScrollReveal>
              )}

              {/* GALLERY tab removed in AD2 — the hero carousel above is
                  the sole place tour photos appear on the page. */}

              {/* WHAT'S INCLUDED - includes / excludes 2-col */}
              {activeTab === "includes" && (
                <ScrollReveal>
                  <div
                    id="tour-tab-panel-includes"
                    role="tabpanel"
                    aria-labelledby="tour-tab-includes"
                    data-testid="tour-tab-panel-includes"
                    className="grid gap-10 sm:grid-cols-2"
                  >
                    {includes.length > 0 && (
                      <div data-testid="tour-section-includes">
                        <h3 className="font-display font-light text-ink text-2xl mb-5">What&apos;s Included</h3>
                        <ul className="space-y-3">
                          {includes.map((inc) => (
                            <li key={inc} className="flex items-start gap-3 text-ink/85">
                              <Check className="h-4 w-4 mt-1 text-nature-mid shrink-0" />
                              <span className="text-sm sm:text-base">{inc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {excludes.length > 0 && (
                      <div data-testid="tour-section-excludes">
                        <h3 className="font-display font-light text-ink text-2xl mb-5">What&apos;s Not Included</h3>
                        <ul className="space-y-3">
                          {excludes.map((exc) => (
                            <li key={exc} className="flex items-start gap-3 text-ink/85">
                              <X className="h-4 w-4 mt-1 text-ink-soft/60 shrink-0" />
                              <span className="text-sm sm:text-base">{exc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </ScrollReveal>
              )}

              {/* PRICES & DATES */}
              {activeTab === "prices" && (
                <ScrollReveal>
                  <div
                    id="tour-tab-panel-prices"
                    role="tabpanel"
                    aria-labelledby="tour-tab-prices"
                    data-testid="tour-tab-panel-prices"
                  >
                    <div className="grid gap-8 sm:grid-cols-2">
                      {tour.priceFrom && (
                        <div className="bg-white rounded-sm p-7 shadow-md border border-nature-deep/8">
                          <p className="label-eyebrow text-nature-mid mb-3">Investment</p>
                          <span className="font-display font-light text-nature-deep text-4xl sm:text-5xl block">{tour.priceFrom}</span>
                          {tour.priceUnit && <p className="text-ink-soft text-sm mt-2">{tour.priceUnit}</p>}
                          {tour.priceNote && <p className="text-ink-soft/80 text-xs mt-1">{tour.priceNote}</p>}
                        </div>
                      )}
                      {(tour.dates || tour.nights) && (
                        <div className="bg-white rounded-sm p-7 shadow-md border border-nature-deep/8">
                          <p className="label-eyebrow text-nature-mid mb-3">Dates</p>
                          {tour.nights && (
                            <div className="flex items-center gap-2 mb-2 text-ink">
                              <Clock className="h-4 w-4 text-gold" />
                              <span className="font-accent text-sm uppercase tracking-label">{tour.nights}</span>
                            </div>
                          )}
                          {tour.dates && (
                            <div className="flex items-center gap-2 text-ink">
                              <Calendar className="h-4 w-4 text-gold" />
                              <span className="font-accent text-sm uppercase tracking-label">{tour.dates}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
                      <CTAButton to="/contact" variant="filled" withArrow data-testid="tour-enquire-prices">
                        {enquireLabel}
                      </CTAButton>
                      {tour.itinerary_url && (
                        <a
                          href={tour.itinerary_url}
                          download={tour.itinerary_filename || "itinerary.pdf"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-7 py-3 border border-nature-deep/30 rounded-full font-accent text-xs sm:text-sm uppercase tracking-label text-ink hover:bg-nature-deep hover:text-cream transition-colors duration-200"
                        >
                          <Download className="h-4 w-4" />
                          {downloadLabel}
                        </a>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </div>

            {/* Always-visible Enquire row below the tabs */}
            <ScrollReveal delay={220}>
              <div className="mt-12 pt-10 border-t border-nature-deep/10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <CTAButton to="/contact" variant="filled" withArrow data-testid="tour-enquire">
                  {enquireLabel}
                </CTAButton>
                <Link
                  to={backLinkTo}
                  className="inline-flex items-center gap-2 text-sm font-accent uppercase tracking-label text-ink-soft hover:text-nature-deep transition-colors duration-200"
                >
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  <span>{backLinkLabel}</span>
                </Link>
              </div>
            </ScrollReveal>
          </div>

          {/* ============ RIGHT: STICKY SIDEBAR ============ */}
          <aside className="lg:col-span-1 min-w-0" data-testid="tour-sidebar">
            <div className="lg:sticky lg:top-24 space-y-6">
              {/* Tour highlights */}
              {highlights.length > 0 && (
                <ScrollReveal delay={120}>
                  <div className="bg-white rounded-sm p-6 sm:p-7 shadow-md border border-nature-deep/8" data-testid="tour-highlights-panel">
                    <h3 className="font-display font-light text-ink text-xl mb-5 pb-3 border-b border-nature-deep/15">
                      {highlightsHeading}
                    </h3>
                    <ul className="space-y-4">
                      {highlights.map((h) => (
                        <li key={h} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
                            <Check className="h-3 w-3 text-nature-deep" strokeWidth={2.5} />
                          </span>
                          <span className="text-sm text-ink/85 leading-snug">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              )}

              {/* Small group tours blurb */}
              <ScrollReveal delay={160}>
                <div className="bg-white rounded-sm p-6 sm:p-7 shadow-md border border-nature-deep/8" data-testid="tour-small-group-panel">
                  <h3 className="font-display font-light text-ink text-xl mb-3 pb-3 border-b border-nature-deep/15">
                    {smallGroupHeading}
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed editorial">{(tour.small_group_text || "").trim() || smallGroupBody}</p>
                </div>
              </ScrollReveal>

              {/* Testimonials */}
              {testimonials.length > 0 && (
                <ScrollReveal delay={200}>
                  <div className="bg-nature-deep text-cream rounded-sm p-6 sm:p-7 shadow-md" data-testid="tour-testimonials-panel">
                    <h3 className="font-display font-light text-cream text-xl mb-5 pb-3 border-b border-cream/20">
                      {testimonialsHeading}
                    </h3>
                    <div className="space-y-6">
                      {testimonials.map((t, i) => (
                        <figure key={i} className="text-sm">
                          <blockquote className="editorial italic text-cream/95 leading-relaxed">
                            &ldquo;{t.quote}&rdquo;
                          </blockquote>
                          {t.author && (
                            <figcaption className="mt-2 font-accent uppercase tracking-label text-[10px] text-gold">
                              {t.author}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </div>
          </aside>
        </div>
      </section>
    </article>
  );
}
