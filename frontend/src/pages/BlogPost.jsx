import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Seo } from "@/components/seo/Seo";
import { FadeImg } from "@/components/ui/FadeImg";
import { ArrowLeft } from "lucide-react";

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
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    setStatus("loading");
    api.get(`/blog/${encodeURIComponent(slug)}`)
      .then(({ data }) => { setPost(data); setStatus("ready"); })
      .catch((e) => {
        if (e?.response?.status === 404) setStatus("not-found");
        else setStatus("error");
      });
  }, [slug]);

  useEffect(() => {
    if (post?.title) document.title = `${post.title} | Once Were Wild`;
  }, [post]);

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

      {post.featured_url && (
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
