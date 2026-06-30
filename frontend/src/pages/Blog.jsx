import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { PageHero } from "@/components/layout/PageHero";
import { useText, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { Seo } from "@/components/seo/Seo";
import { FadeImg } from "@/components/ui/FadeImg";
import { ArrowRight } from "lucide-react";

const PAGE_SIZE = 9;

function formatPublishedDate(raw) {
  if (!raw) return "";
  // Accept YYYY-MM-DD or any parseable string.
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function Blog() {
  const eyebrow = useText("blog.hero.eyebrow", "From the Road");
  const title = useRichText("blog.hero.title", "The *Once Were Wild* journal.");
  const intro = useText(
    "blog.hero.intro",
    "Field notes, slow reflections and stories from journeys taken outside the scheduled calendar.",
  );
  const emptyHeading = useText("blog.empty.heading", "Stories are on their way.");
  const emptyBody = useText(
    "blog.empty.body",
    "Our first journal entries are being written between trips. Check back soon, or follow the road with us on Instagram.",
  );
  // AF - additional public-facing strings the operator can edit.
  const loadingLabel = useText("blog.loading", "Loading the journal...");
  const loadMoreLabel = useText("blog.load_more", "Read more posts");
  const cardReadMore = useText("blog.card.read_more", "Read more");

  const { src: heroImg, lqip: heroLqip, srcset: heroSrcset } = useMediaSlot("blog-hero");

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    api.get("/blog")
      .then(({ data }) => setPosts(data || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => posts.slice(0, visible), [posts, visible]);
  const hasMore = posts.length > visible;

  return (
    <div data-testid="blog-page">
      <Seo
        page="blog"
        path="/blog"
        title="Blog | Once Were Wild Travel"
        description="Field notes and travel stories from the women behind Once Were Wild Travel."
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

      <section className="bg-cream py-20 sm:py-28" data-testid="blog-list">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          {loading ? (
            <div className="text-center text-ink-soft text-base py-16">{loadingLabel}</div>
          ) : posts.length === 0 ? (
            <div className="mx-auto max-w-2xl text-center py-12" data-testid="blog-empty-state">
              <p className="label-eyebrow text-nature-mid mb-4">{eyebrow}</p>
              <h2 className="font-display font-light text-ink text-3xl sm:text-4xl leading-tight mb-5">
                {emptyHeading}
              </h2>
              <p className="editorial text-ink-soft text-base sm:text-lg leading-relaxed">
                {emptyBody}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                {shown.map((p) => (
                  <BlogCard key={p.id} post={p} readMoreLabel={cardReadMore} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-14 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 rounded-full border border-nature-deep px-7 py-3 text-sm tracking-widest uppercase text-nature-deep hover:bg-nature-deep hover:text-cream transition-colors"
                    data-testid="blog-load-more"
                  >
                    {loadMoreLabel}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function BlogCard({ post, readMoreLabel }) {
  return (
    <Link
      to={`/blog/${post.slug || post.id}`}
      className="group block bg-white border border-black/5 rounded-md overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
      data-testid={`blog-card-${post.slug || post.id}`}
    >
      <div className="aspect-[16/10] overflow-hidden bg-nature-deep/5">
        {post.featured_url ? (
          <FadeImg
            src={post.featured_url}
            srcset={post.featured_srcset}
            avifSrcset={post.featured_avif_srcset}
            lqip={post.featured_lqip}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-nature-mid/40 text-xs tracking-widest uppercase">
            Once Were Wild
          </div>
        )}
      </div>
      <div className="p-6 sm:p-7">
        <p className="text-xs tracking-widest uppercase text-nature-mid mb-3">
          {formatPublishedDate(post.published_date)}
        </p>
        <h3 className="font-display font-light text-ink text-xl sm:text-2xl leading-snug mb-3 group-hover:text-nature-deep transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-ink-soft text-base leading-relaxed line-clamp-3">{post.excerpt}</p>
        )}
        <span className="mt-5 inline-flex items-center gap-1 text-xs tracking-widest uppercase text-nature-deep">
          {readMoreLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
