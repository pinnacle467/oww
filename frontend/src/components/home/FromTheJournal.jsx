import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useText, useRichText } from "@/context/ContentContext";
import { FadeImg } from "@/components/ui/FadeImg";
import { ArrowRight } from "lucide-react";

function formatPublishedDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// Three latest published posts from /api/blog. Hides itself when no posts
// are published so the homepage never shows an empty section.
export function FromTheJournal() {
  const eyebrow = useText("home.journal.eyebrow", "From the Journal");
  const title = useRichText("home.journal.title", "Stories from *the road less travelled.*");
  const intro = useText(
    "home.journal.intro",
    "Field notes and slow reflections from journeys taken between scheduled tours.",
  );
  const ctaLabel = useText("home.journal.cta", "Read the journal");

  const [posts, setPosts] = useState(null); // null = loading, [] = empty

  useEffect(() => {
    api.get("/blog")
      .then(({ data }) => setPosts((data || []).slice(0, 3)))
      .catch(() => setPosts([]));
  }, []);

  // Hide the section entirely while loading or when there is nothing to show.
  if (!posts || posts.length === 0) return null;

  return (
    <section
      className="bg-cream py-20 sm:py-28 lg:py-32"
      data-testid="home-journal-strip"
      aria-label="From the journal"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-20">
          <p className="label-eyebrow text-nature-mid mb-4" data-testid="home-journal-eyebrow">
            {eyebrow}
          </p>
          <h2
            className="font-display font-light text-ink text-3xl sm:text-4xl lg:text-5xl leading-tight mb-5"
            data-testid="home-journal-title"
          >
            {title}
          </h2>
          <p className="editorial text-ink-soft text-base sm:text-lg leading-relaxed">
            {intro}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {posts.map((p) => (
            <JournalCard key={p.id} post={p} />
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 rounded-full border border-nature-deep px-7 py-3 text-sm tracking-widest uppercase text-nature-deep hover:bg-nature-deep hover:text-cream transition-colors"
            data-testid="home-journal-cta"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function JournalCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug || post.id}`}
      className="group block bg-white border border-black/5 rounded-md overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
      data-testid={`home-journal-card-${post.slug || post.id}`}
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
          Read more
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
