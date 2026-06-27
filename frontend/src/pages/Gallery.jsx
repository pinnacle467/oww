import { useEffect } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { MasonryGallery } from "@/components/gallery/MasonryGallery";
import { GALLERY_ITEMS } from "@/data/content";
import { useMedia } from "@/hooks/useMedia";
import { useGalleryCategories } from "@/hooks/useGalleryCategories";
import { useText, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { Seo } from "@/components/seo/Seo";

export default function Gallery() {
  // Wait for the API before painting so we never flash a replaced photo.
  // Wait for the API before painting so we never flash a replaced photo.
  const { items: media, ready } = useMedia("gallery");
  const items = ready ? media : [];
  const { categories } = useGalleryCategories();
  const eyebrow = useText("gallery.hero.eyebrow", "The Gallery");
  const title = useRichText("gallery.hero.title", "Moments that linger *long after.*");
  const intro = useText("gallery.hero.intro", "A gathering of light, landscape and laughter from the road. Wander through, and imagine yourself among them.");
  const { src: heroImg, lqip: heroLqip, srcset: heroSrcset } = useMediaSlot("gallery-hero");

  return (
    <div data-testid="gallery-page">
      <Seo
        page="gallery"
        path="/gallery"
        image={heroImg && heroImg.startsWith("http") ? heroImg : undefined}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          "name": "Once Were Wild, gallery",
          "url": "https://oncewerewild.com/gallery",
          "numberOfItems": items.length,
          "provider": { "@id": "https://oncewerewild.com/#organization" },
        }}
      />
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImg}
        srcset={heroSrcset}
        lqip={heroLqip}
      />
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <MasonryGallery items={items} categories={categories} />
        </div>
      </section>
    </div>
  );
}
