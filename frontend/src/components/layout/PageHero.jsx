import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { FadeImg } from "@/components/ui/FadeImg";

export function PageHero({ eyebrow, title, intro, image, srcset = null, lqip = "", height = "h-[62vh]" }) {
  // The LQIP (~600 B inline base64 WebP) paints in the FIRST frame so the
  // hero is never a flat green block while the full image downloads. We
  // also fall back to bg-ink (dark, neutral) instead of bg-nature-deep so
  // any failure shows a calm dark backdrop rather than the dreaded green.
  return (
    <section className={`relative ${height} min-h-[440px] flex items-end overflow-hidden bg-ink`} data-testid="page-hero">
      <div className="absolute inset-0">
        {lqip && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${lqip})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "saturate(1.05)",
            }}
          />
        )}
        <FadeImg
          src={image}
          srcset={srcset}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="h-full w-full object-cover animate-kenburns"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-nature-deep/90 via-nature-deep/30 to-nature-deep/40" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 pb-14 sm:pb-20">
        <div className="glass rounded-sm px-7 py-9 sm:px-11 sm:py-11 max-w-2xl">
          {eyebrow && <p className="label-eyebrow text-gold mb-4">{eyebrow}</p>}
          <h1 className="font-display font-light text-white text-shadow-soft text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">{title}</h1>
          {intro && <p className="editorial text-white/85 mt-5 text-lg max-w-xl">{intro}</p>}
        </div>
      </div>
    </section>
  );
}

export default PageHero;
