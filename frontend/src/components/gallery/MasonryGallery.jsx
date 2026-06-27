import { useState, useMemo, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";

// Lightbox is fetched only when a visitor actually clicks a tile to open
// it - saves ~20 KB from the initial Gallery bundle. The fallback is null
// because Lightbox is invisible until index !== null anyway.
const Lightbox = lazy(() =>
  import("@/components/gallery/Lightbox").then((m) => ({ default: m.Lightbox }))
);

export function MasonryGallery({ items, categories }) {
  const hasCategories = Array.isArray(categories) && categories.length > 0;
  const [active, setActive] = useState(hasCategories ? categories[0] : null);
  const [lightIndex, setLightIndex] = useState(null);

  // "All" tab removed by product design: always filter strictly by the
  // selected category. If categories are missing (legacy/empty), show
  // everything so we never render a blank grid.
  const filtered = useMemo(() => {
    if (!hasCategories || !active) return items;
    return items.filter((i) => i.category === active);
  }, [items, active, hasCategories]);

  return (
    <>
      {hasCategories && (
        <div className="flex flex-wrap justify-center gap-2.5 mb-12" data-testid="gallery-filters">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={cn(
                "rounded-full px-5 py-2.5 font-accent text-[11px] uppercase tracking-label transition-all duration-300",
                active === c ? "bg-nature-deep text-cream" : "border border-nature-deep/20 text-ink-soft hover:border-nature-mid hover:text-nature-deep"
              )}
              data-testid={`gallery-filter-${c.toLowerCase()}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]" data-testid="masonry-grid">
        {filtered.map((item, i) => {
          const isVideo = item.file_type === "video" || /\.(mp4|webm|mov)$/i.test(item.src || "");
          // For videos we render the poster frame (thumb) — never the .mp4
          // URL directly, which would render as a broken image. If the
          // thumbnail is missing (legacy upload, ffmpeg failure), fall back
          // to a quiet brand-coloured placeholder.
          const posterSrc = isVideo ? (item.thumb || "") : item.src;
          return (
            <div
              key={item.id || item.src}
              className="mb-5 break-inside-avoid opacity-0 animate-fade-up"
              style={{ animationDelay: `${(i % 6) * 70}ms` }}
            >
              <button
                onClick={() => setLightIndex(i)}
                className="group relative block w-full overflow-hidden rounded-sm"
                data-testid={`gallery-item-${i + 1}`}
              >
                {posterSrc ? (
                  <img
                    src={posterSrc}
                    srcSet={!isVideo && item.srcset ? Object.entries(item.srcset).map(([w, u]) => `${u} ${w}`).join(", ") : undefined}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    alt={item.alt || item.caption || (isVideo ? "Video clip from a Once Were Wild journey" : "Photograph from a Once Were Wild women's small group journey")}
                    loading="lazy"
                    decoding="async"
                    width="800"
                    height="600"
                    className="w-full object-cover transition-transform duration-[1.1s] group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="w-full aspect-[4/3] bg-nature-deep/80"
                    style={item.lqip ? { backgroundImage: `url(${item.lqip})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                  />
                )}
                <div className="absolute inset-0 bg-nature-deep/0 group-hover:bg-nature-deep/40 transition-colors duration-500" />
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="glass rounded-full p-4 text-white"><Play className="h-6 w-6" /></span>
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {lightIndex !== null && (
        <Suspense fallback={null}>
          <Lightbox
            items={filtered}
            index={lightIndex}
            onClose={() => setLightIndex(null)}
            onPrev={() => setLightIndex((i) => (i - 1 + filtered.length) % filtered.length)}
            onNext={() => setLightIndex((i) => (i + 1) % filtered.length)}
          />
        </Suspense>
      )}
    </>
  );
}

export default MasonryGallery;
