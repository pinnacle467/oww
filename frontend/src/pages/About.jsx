import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHero } from "@/components/layout/PageHero";
import { useText, useRichText, useContent } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { Seo } from "@/components/seo/Seo";
import { FadeImg } from "@/components/ui/FadeImg";
import { TravelGallery } from "@/components/about/TravelGallery";
import { ArrowUpRight } from "lucide-react";

// Public About page. Content blocks + cover stories are entirely admin-driven.
export default function About() {
  const eyebrow = useText("about.hero.eyebrow", "About Us");
  const title = useRichText("about.hero.title", "The women behind *the wild.*");
  const intro = useText("about.hero.intro", "Slow, soulful journeys built by women who have walked the path themselves.");
  const { src: heroImg, lqip: heroLqip, srcset: heroSrcset } = useMediaSlot("about-hero");

  const [blocks, setBlocks] = useState([]);
  const [stories, setStories] = useState([]);

  useEffect(() => {
    api.get("/about-blocks").then(({ data }) => setBlocks(data || [])).catch(() => {});
    api.get("/stories").then(({ data }) => setStories(data || [])).catch(() => {});
  }, []);

  return (
    <div data-testid="about-page">
      <Seo
        page="about"
        path="/about"
        image={heroImg && heroImg.startsWith("http") ? heroImg : undefined}
      />
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImg}
        srcset={heroSrcset}
        lqip={heroLqip}
      />

      <section className="bg-cream py-20 sm:py-28" data-testid="about-body">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-14 lg:grid-cols-12 lg:gap-16">
          {/* About text — left column, ~35% on desktop */}
          <div className="lg:col-span-4" data-testid="about-blocks">
            <p className="label-eyebrow text-nature-mid mb-4">Our Story</p>
            {blocks.length === 0 ? (
              <p className="editorial text-ink-soft text-base">More about us, coming soon.</p>
            ) : (
              <div className="space-y-5">
                {blocks.map((b) => (
                  b.kind === "heading" ? (
                    <h2 key={b.id} className="font-display font-light text-ink text-2xl sm:text-3xl leading-tight mt-6 first:mt-0">
                      {b.text}
                    </h2>
                  ) : (
                    <p key={b.id} className="editorial text-ink-soft text-base sm:text-lg leading-relaxed">
                      {b.text}
                    </p>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Stories — right column, ~65% width on desktop */}
          <div className="lg:col-span-8" data-testid="about-stories">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="label-eyebrow text-nature-mid mb-2">Field Notes</p>
                <h2 className="font-display font-light text-ink text-3xl sm:text-4xl leading-tight">
                  Stories from <em className="italic">the road.</em>
                </h2>
              </div>
            </div>

            {stories.length === 0 ? (
              <div className="rounded-sm border border-nature-deep/15 bg-white p-10 text-center">
                <p className="editorial text-ink-soft">New stories are being written. Check back soon.</p>
              </div>
            ) : (
              <div className="grid gap-7 sm:grid-cols-2">
                {stories.map((s) => (
                  <article
                    key={s.id}
                    className="group bg-white rounded-sm overflow-hidden border border-nature-deep/10 shadow-sm hover:shadow-xl transition-shadow duration-500 flex flex-col"
                    data-testid={`story-card-${s.id}`}
                  >
                    {s.cover_url ? (
                      <div className="aspect-[16/10] overflow-hidden bg-nature-deep/10">
                        <FadeImg
                          src={s.cover_url}
                          srcset={s.cover_srcset}
                          avifSrcset={s.cover_avif_srcset}
                          lqip={s.cover_lqip}
                          alt={s.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-[1.1s] group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-nature-deep/80 to-nature-mid" />
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-2 text-[11px] font-accent uppercase tracking-label text-ink-soft mb-3">
                        {s.region && <span>{s.region}</span>}
                        {s.region && s.date && <span className="text-gold">•</span>}
                        {s.date && <span>{s.date}</span>}
                      </div>
                      <h3 className="font-display font-light text-ink text-xl sm:text-2xl leading-tight mb-3">
                        {s.title}
                      </h3>
                      {s.excerpt && (
                        <p className="editorial text-ink-soft text-sm leading-relaxed mb-4 flex-1">
                          {s.excerpt}
                        </p>
                      )}
                      {s.body && (
                        <details className="mt-auto" data-testid={`story-body-${s.id}`}>
                          <summary className="cursor-pointer font-accent text-[11px] uppercase tracking-label text-nature-mid hover:text-nature-deep transition-colors">
                            Read story
                          </summary>
                          {/* Render the story body as proper paragraphs so the
                              operator's blank lines in admin become real
                              vertical spacing (not a collapsed string). Split
                              on one-or-more blank lines, preserve single
                              newlines inside a paragraph via whitespace-pre-line.
                              Fixes client report: trailing blank line before
                              "TRAVEL LIVED ... IS A LIFE TRULY LOVED" was not
                              showing on the live site. */}
                          <div className="mt-4 editorial text-ink/85 text-sm leading-relaxed space-y-4">
                            {s.body
                              .replace(/\r\n/g, "\n")
                              .split(/\n\s*\n+/)
                              .map((para, pi) => para.trim() ? (
                                <p key={pi} className="whitespace-pre-line">{para}</p>
                              ) : null)
                              .filter(Boolean)}
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Phase 2 (Change 5) - travel photos and videos in a swipeable strip. */}
      <TravelGallery />

      {/* AE - Sister Brands. Two other businesses Adele operates, both in
          Maleny. All copy + URLs editable from /admin/website-text > About
          page. A brand row with both URL fields empty is hidden, so the
          client can drop one of the two without code changes. */}
      <SisterBrands />
    </div>
  );
}

// =====================================================================
// AE - Sister Brands section. Dark accent card row that sits at the very
// bottom of the About page, just below the TravelGallery. Every string is
// admin-editable via /admin/website-text > About page.
// =====================================================================
function SisterBrands() {
  const { content } = useContent();
  const eyebrow = useText("about.sister.eyebrow", "Also by Adele");
  const titleNode = useRichText("about.sister.title", "Two more places to *stay and gather.*");
  const introNode = useRichText(
    "about.sister.intro",
    "Discover the boutique hinterland hospitality and intimate elopement experiences that Adele also curates in Maleny."
  );
  const introRaw = useText("about.sister.intro", "");
  const ctaLabel = useText("about.sister.cta", "Visit website");

  // Build the brand list from indexed content keys. A brand is rendered
  // only when it has a non-empty URL. Easy to extend to a 3rd brand
  // later: just add `about.sister.2.*` keys via admin.
  const brands = [];
  for (let i = 0; i < 4; i++) {
    const url = (content[`about.sister.${i}.url`] || "").trim();
    const name = (content[`about.sister.${i}.name`] || "").trim();
    const tagline = (content[`about.sister.${i}.tagline`] || "").trim();
    if (url && name) brands.push({ url, name, tagline, i });
  }
  if (brands.length === 0) return null;

  return (
    <section className="bg-nature-deep text-cream py-20 sm:py-28" data-testid="about-sister-brands">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="text-center mb-12 sm:mb-14 max-w-3xl mx-auto">
          <p className="label-eyebrow text-gold mb-3" data-testid="sister-eyebrow">{eyebrow}</p>
          <h2
            className="font-display font-light text-cream text-3xl sm:text-4xl lg:text-5xl leading-tight tracking-tight"
            data-testid="sister-title"
          >
            {titleNode}
          </h2>
          {introRaw && (
            <p
              className="editorial text-cream/80 text-base sm:text-lg leading-relaxed mt-5"
              data-testid="sister-intro"
            >
              {introNode}
            </p>
          )}
        </div>

        <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
          {brands.map((b) => (
            <a
              key={b.i}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col p-7 sm:p-9 rounded-sm bg-cream/[0.04] border border-cream/15 hover:bg-cream/[0.08] hover:border-gold/60 transition-all duration-300"
              data-testid={`sister-card-${b.i}`}
            >
              <span className="absolute top-5 right-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream/25 text-cream/70 group-hover:bg-gold group-hover:text-ink group-hover:border-gold transition-all duration-300">
                <ArrowUpRight className="h-4 w-4" />
              </span>

              <p className="label-eyebrow text-gold/90 mb-3 text-[10px]">Sister brand</p>
              <h3
                className="font-display font-light text-cream text-2xl sm:text-3xl leading-tight tracking-tight pr-12"
                data-testid={`sister-name-${b.i}`}
              >
                {b.name}
              </h3>
              {b.tagline && (
                <p
                  className="editorial italic text-cream/75 text-base leading-relaxed mt-4"
                  data-testid={`sister-tagline-${b.i}`}
                >
                  {b.tagline}
                </p>
              )}

              <span className="mt-7 inline-flex items-center gap-2 font-accent text-[11px] uppercase tracking-label text-gold group-hover:text-cream transition-colors duration-300">
                {ctaLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>

              <span className="mt-3 text-[11px] font-accent uppercase tracking-label text-cream/40 truncate">
                {b.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
