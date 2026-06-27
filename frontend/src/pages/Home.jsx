import { HeroSlideshow } from "@/components/home/HeroSlideshow";
import { BrandManifesto } from "@/components/home/BrandManifesto";
import { ExperiencePillars } from "@/components/home/ExperiencePillars";
import { ImmersiveTeaser } from "@/components/home/ImmersiveTeaser";
import { MalenyFeature } from "@/components/home/MalenyFeature";
import { FromTheJournal } from "@/components/home/FromTheJournal";
import { Testimonials } from "@/components/home/Testimonials";
import { Seo } from "@/components/seo/Seo";

export default function Home() {
  return (
    <article data-testid="home-page">
      <Seo
        page="home"
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": "https://oncewerewild.com/#webpage",
          "url": "https://oncewerewild.com/",
          "name": "Once Were Wild Travel, slow, soulful journeys for women",
          "isPartOf": { "@id": "https://oncewerewild.com/#website" },
          "about": { "@id": "https://oncewerewild.com/#organization" },
          "inLanguage": "en-AU",
        }}
      />
      <HeroSlideshow />
      <BrandManifesto />
      <ExperiencePillars />
      <ImmersiveTeaser />
      <MalenyFeature />
      <FromTheJournal />
      <Testimonials />
    </article>
  );
}
