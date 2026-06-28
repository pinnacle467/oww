import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSwipeNav } from "@/hooks/useSwipeNav";

export function Lightbox({ items, index, onClose, onPrev, onNext }) {
  const handleKey = useCallback((e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") onPrev();
    if (e.key === "ArrowRight") onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    if (index == null) return;
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey, index]);

  // Phase 4: touch swipe on mobile devices (left/right to navigate between
  // gallery items). Vertical drags still bubble through (touchAction:
  // pan-y) so the page scrolls normally on the lightbox backdrop. Video
  // scrubbing is excluded so playback controls keep working.
  const hasMultiple = Array.isArray(items) && items.length > 1;
  const swipe = useSwipeNav({
    onNext: hasMultiple ? onNext : undefined,
    onPrev: hasMultiple ? onPrev : undefined,
  });

  if (index == null) return null;
  const item = items[index];
  const isVideo = item.file_type === "video" || /\.(mp4|webm|mov)$/i.test(item.src || "");

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-nature-deep/90 backdrop-blur-md p-4 sm:p-8"
      data-testid="lightbox"
      onClick={onClose}
      {...swipe}
    >
      <button onClick={onClose} className="absolute top-5 right-5 glass-dark rounded-full p-3 text-cream hover:text-gold transition-colors z-10" aria-label="Close" data-testid="lightbox-close">
        <X className="h-5 w-5" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-3 sm:left-6 glass-dark rounded-full p-3 text-cream hover:text-gold transition-colors z-10" aria-label="Previous" data-testid="lightbox-prev">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-3 sm:right-6 glass-dark rounded-full p-3 text-cream hover:text-gold transition-colors z-10" aria-label="Next" data-testid="lightbox-next">
        <ChevronRight className="h-6 w-6" />
      </button>

      <figure className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={item.src} poster={item.thumb || undefined} controls autoPlay playsInline className="w-full max-h-[78vh] rounded-sm bg-black" data-testid="lightbox-video" />
        ) : (
          <img
            src={item.src}
            srcSet={item.srcset ? Object.entries(item.srcset).map(([w, u]) => `${u} ${w}`).join(", ") : undefined}
            sizes="(min-width: 1024px) 80vw, 100vw"
            alt={item.alt || item.caption || "Once Were Wild women's small group journey gallery photograph"}
            className="w-full max-h-[78vh] object-contain rounded-sm"
            data-testid="lightbox-image"
          />
        )}
      </figure>
    </div>
  );
}

export default Lightbox;
