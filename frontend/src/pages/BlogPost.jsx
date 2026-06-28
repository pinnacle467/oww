import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Seo } from "@/components/seo/Seo";
import { FadeImg } from "@/components/ui/FadeImg";
import { SwipeableMedia } from "@/components/media/SwipeableMedia";
import { ArrowLeft } from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const abs = (u) => (u && API_BASE && u.startsWith("/") ? `${API_BASE}${u}` : u);
const absMap = (m) => {
  if (!m || typeof m !== "object") return null;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, abs(v)]));
};

function formatPublishedDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [mediaMap, setMediaMap] = useState({});
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    setStatus("loading");
    Promise.all([
      api.get(`/blog/${encodeURIComponent(slug)}`),
      api.get(`/media`).catch(() => ({ data: [] })),
    ])
      .then(([postRes, mediaRes]) => {
        setPost(postRes.data);
        const m = {};
        (mediaRes.data || []).forEach((row) => { m[row.id] = row; });
        setMediaMap(m);
        setStatus("ready");
      })
      .catch((e) => {
        if (e?.response?.status === 404) setStatus("not-found");
        else setStatus("error");
      });
  }, [slug]);

  useEffect(() => {
    if (post?.title) document.title = `${post.title} | Once Were Wild`;
  }, [post]);

  // Phase 3 - multi-cover gallery items resolved from media_ids on the post.
  const galleryItems = useMemo(() => {
    if (!post) return [];
    const ids = Array.isArray(post.media_ids) ? post.media_ids : [];
    return ids
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
          alt: m.alt_text || m.caption || m.alt || post.title || "",
          caption: m.caption || "",
          embed_provider: m.embed_provider || null,
          embed_id: m.embed_id || null,
        };
      });
  }, [post, mediaMap]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream">
        <div className="text-nature-deep text-sm tracking-widest uppercase opacity-60">Loading...</div>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 bg-cream px-6 py-20 text-center" data-testid="blog-post-not-found">
        <h1 className="font-display font-light text-ink text-3xl sm:text-4xl">Post not found</h1>
        <p className="text-ink-soft max-w-md">This post may have been removed or is still being drafted. The journal index has every published story.</p>
        <button
          onClick={() => navigate("/blog")}
          className="inline-flex items-center gap-2 rounded-full border border-nature-deep px-6 py-2.5 text-xs tracking-widest uppercase text-nature-deep hover:bg-nature-deep hover:text-cream transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to journal
        </button>
      </div>
    );
  }

  if (!post) return null;

  return (
    <article className="bg-cream" data-testid="blog-post-page">
      <Seo
        page="blog"
        path={`/blog/${post.slug || ""}`}
        title={`${post.title} | Once Were Wild`}
        description={post.excerpt || undefined}
        image={post.featured_url && post.featured_url.startsWith("http") ? post.featured_url : undefined}
      />

      <header className="pt-20 sm:pt-28 pb-10 sm:pb-14 bg-cream">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-nature-mid hover:text-nature-deep mb-8"
            data-testid="blog-post-back-link"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the journal
          </Link>
          <p className="text-xs tracking-widest uppercase text-nature-mid mb-4">
            {formatPublishedDate(post.published_date)}
          </p>
          <h1 className="font-display font-light text-ink text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="editorial text-ink-soft text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto">
              {post.excerpt}
            </p>
          )}
        </div>
      </header>

      {/* Phase 3 - prefer multi-cover gallery (media_ids) when set; fall back
          to single featured_url. Single gallery item renders as plain image
          (cleaner UX, fewer chrome elements). */}
      {galleryItems.length > 1 && (
        <div
          className="mx-auto max-w-5xl px-5 sm:px-8 mb-12 sm:mb-16"
          data-testid="blog-post-multicover"
        >
          <SwipeableMedia
            items={galleryItems}
            aspectRatio="16/9"
            testId="blog-post-swiper"
          />
        </div>
      )}

      {galleryItems.length === 1 && (
        <div className="mx-auto max-w-5xl px-5 sm:px-8 mb-12 sm:mb-16" data-testid="blog-post-multicover-single">
          {galleryItems[0].kind === "image" ? (
            <div className="aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-md bg-nature-deep/5">
              <FadeImg
                src={galleryItems[0].url}
                srcset={galleryItems[0].srcset}
                avifSrcset={galleryItems[0].avif_srcset}
                lqip={galleryItems[0].lqip}
                alt={galleryItems[0].alt}
                className="w-full h-full object-cover"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />
            </div>
          ) : (
            <SwipeableMedia
              items={galleryItems}
              aspectRatio="16/9"
              testId="blog-post-swiper"
            />
          )}
        </div>
      )}

      {galleryItems.length === 0 && post.featured_url && (
        <div className="mx-auto max-w-5xl px-5 sm:px-8 mb-12 sm:mb-16" data-testid="blog-post-featured-image">
          <div className="aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-md bg-nature-deep/5">
            <FadeImg
              src={post.featured_url}
              srcset={post.featured_srcset}
              avifSrcset={post.featured_avif_srcset}
              lqip={post.featured_lqip}
              alt={post.title}
              className="w-full h-full object-cover"
              sizes="(min-width: 1024px) 1024px, 100vw"
            />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-5 sm:px-8 pb-24 sm:pb-32">
        <div
          className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-light prose-headings:text-ink prose-h2:text-3xl prose-h3:text-2xl prose-p:text-ink-soft prose-p:leading-relaxed prose-a:text-nature-deep prose-a:no-underline hover:prose-a:underline prose-img:rounded-md prose-blockquote:border-l-nature-mid prose-blockquote:text-ink-soft prose-strong:text-ink"
          dangerouslySetInnerHTML={{ __html: post.body || "" }}
          data-testid="blog-post-body"
        />

        <div className="mt-16 pt-10 border-t border-black/10 flex justify-between items-center">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-nature-deep hover:underline"
            data-testid="blog-post-back-bottom"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the journal
          </Link>
        </div>
      </div>
    </article>
  );
}
