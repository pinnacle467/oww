import { HeroSlideshow } from "@/components/home/HeroSlideshow";
import { BrandManifesto } from "@/components/home/BrandManifesto";
import { ExperiencePillars } from "@/components/home/ExperiencePillars";
import { ToursCtaCard } from "@/components/home/ToursCtaCard";
import { HomeContent } from "@/components/home/HomeContent";
import { QuestionsAnswered } from "@/components/home/QuestionsAnswered";
import { FromTheJournal } from "@/components/home/FromTheJournal";
import { Testimonials } from "@/components/home/Testimonials";
import { Seo } from "@/components/seo/Seo";

// Home page layout (top to bottom):
//   1. Hero slideshow
//   2. Brand manifesto
//   3. Experience pillars (3-card grid)
//   4. Tours CTA card (replaces the older Tasmania + Maleny repeated marketing
//      blocks: the client felt nav links were sufficient, this is a single
//      compact nudge to /pricing instead)
//   5. Long-form home content sections (admin-managed, ~2,500 words of SEO copy)
//   6. "Questions Gently Answered" FAQ accordion (admin-managed)
//   7. From the Journal (3 latest blog posts, auto-hides when none)
//   8. Testimonials
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
      <ToursCtaCard />
      <HomeContent />
      <QuestionsAnswered />
      <FromTheJournal />
      <Testimonials />
    </article>
  );
}
