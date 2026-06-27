import { useState } from "react";
import { cn } from "@/lib/utils";

// <FadeImg> renders an image inside a <picture> that prefers AVIF
// (~20-35% smaller than WebP) and falls back to WebP for browsers that
// can't decode AVIF. The image fades in once decoded so swapping `src`
// never produces a flash. The placeholder behind it is whatever the
// parent paints - usually a section background colour.
//
// Props:
//   src           : the WebP URL (also acts as the visible <img src>)
//   srcset        : { "800w": webpUrl, ... }   -> webp <source srcset>
//   avifSrcset    : { "800w": avifUrl, ... }   -> avif <source srcset>
//                   omit (or pass empty) to skip the AVIF source entirely
//   sizes         : standard <img sizes> hint, default "100vw"
//
// Phones pull the 800w variant (~75 KB WebP, or ~50 KB AVIF) instead of
// the desktop one (~290 KB).
export function FadeImg({
  src,
  srcset = null,
  avifSrcset = null,
  sizes = "100vw",
  alt = "",
  className = "",
  imgClassName = "",
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);
  if (!src) return <div className={cn(className, "bg-ink/[0.04]")} />;
  const webpSrcSet = srcset
    ? Object.entries(srcset).map(([w, u]) => `${u} ${w}`).join(", ")
    : undefined;
  const avifSrcSet = avifSrcset && Object.keys(avifSrcset).length
    ? Object.entries(avifSrcset).map(([w, u]) => `${u} ${w}`).join(", ")
    : null;

  const imgEl = (
    <img
      key={src}
      src={src}
      srcSet={webpSrcSet}
      sizes={webpSrcSet ? sizes : undefined}
      alt={alt}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn(
        className,
        imgClassName,
        "transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
      )}
      {...rest}
    />
  );

  // If we don't have AVIF for this asset, render a bare <img> — wrapping
  // it in <picture> would just add DOM noise for no win.
  if (!avifSrcSet) return imgEl;

  return (
    <picture>
      <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
      {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />}
      {imgEl}
    </picture>
  );
}

export default FadeImg;
