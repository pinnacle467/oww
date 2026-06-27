import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHero } from "@/components/layout/PageHero";
import { useText, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { Seo } from "@/components/seo/Seo";
import { FadeImg } from "@/components/ui/FadeImg";

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
                          <div className="mt-4 editorial text-ink/85 text-sm leading-relaxed whitespace-pre-wrap">
                            {s.body}
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
    </div>
  );
}
