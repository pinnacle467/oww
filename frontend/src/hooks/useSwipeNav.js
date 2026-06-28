import { useRef } from "react";

// Tiny shared hook: returns touch handlers that fire `onNext` / `onPrev`
// when the user swipes the wrapped element left/right beyond a small
// threshold. Direction filter ignores mostly-vertical drags so page
// scrolls still work. Used by lightboxes site-wide (SwipeableMedia
// fullscreen viewer + the Gallery masonry Lightbox) so any image / video
// the visitor taps on can be swiped through next/prev on mobile.
//
// Usage:
//   const swipe = useSwipeNav({ onNext, onPrev });
//   <div {...swipe}>...</div>
//
// Parameters:
//   onNext / onPrev      - required navigation callbacks.
//   threshold (default 40px) - minimum horizontal distance to trigger.
//   skipSelectors        - CSS selectors that should NOT swipe when the
//                          touch starts inside one of them. Defaults to
//                          ["video"] so scrubbing video controls works.

export function useSwipeNav({ onNext, onPrev, threshold = 40, skipSelectors = ["video"] }) {
  const startX = useRef(null);
  const startY = useRef(null);
  const locked = useRef(false);
  const skipped = useRef(false);

  const insideSkip = (target) => {
    if (!target || !target.closest) return false;
    return skipSelectors.some((sel) => target.closest(sel));
  };

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    skipped.current = insideSkip(e.target);
    if (skipped.current) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    locked.current = false;
  };

  const onTouchMove = (e) => {
    if (skipped.current || startX.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!locked.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      locked.current = true;
    }
  };

  const onTouchEnd = (e) => {
    if (skipped.current || startX.current == null) {
      startX.current = null;
      startY.current = null;
      skipped.current = false;
      return;
    }
    const t = e.changedTouches && e.changedTouches[0];
    const dx = t ? t.clientX - startX.current : 0;
    startX.current = null;
    startY.current = null;
    if (!locked.current) return;
    if (dx <= -threshold && typeof onNext === "function") onNext();
    else if (dx >= threshold && typeof onPrev === "function") onPrev();
  };

  return { onTouchStart, onTouchMove, onTouchEnd, style: { touchAction: "pan-y" } };
}

export default useSwipeNav;
