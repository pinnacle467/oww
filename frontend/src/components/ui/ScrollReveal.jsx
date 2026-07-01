import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Lightweight Intersection Observer reveal. No external libraries.
export function ScrollReveal({ children, className, delay = 0, mask = false, as: Tag = "div", ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.unobserve(entry.target);
          }
        });
      },
      // threshold: 0 -> reveal as soon as ANY pixel of the target enters the
      // viewport. The previous 0.15 threshold broke on mobile for tall
      // targets (e.g. the tour Details tab panel is often >3000 px tall so
      // even when partially visible its intersectionRatio stays <=0.23,
      // and on first paint it sits at ~0.07 which is below 0.15 -> the
      // element never revealed and users saw a blank section below the
      // tab strip). rootMargin also relaxed so we don't lock content
      // behind the last 8% of the viewport.
      { threshold: 0, rootMargin: "0px" }
    );
    obs.observe(el);
    // Belt-and-braces fallback: some mobile browsers occasionally fail to
    // deliver the initial IntersectionObserver callback (especially when
    // the element mounts inside a tab panel whose parent is animating).
    // If we're still hidden after 800 ms, just reveal - the user is on the
    // page, the animation-in effect is nice-to-have but content is not.
    const fallback = window.setTimeout(() => setVisible(true), 800);
    return () => { obs.disconnect(); window.clearTimeout(fallback); };
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(mask ? "reveal-mask" : "reveal", visible && "is-visible", className)}
      style={{ transitionDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default ScrollReveal;
