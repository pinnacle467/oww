import { useRef } from "react";
import { TESTIMONIALS } from "@/data/content";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Leaf } from "lucide-react";
import { useContent } from "@/context/ContentContext";
import { useText, useRichText } from "@/context/ContentContext";

export function Testimonials() {
  const ref = useRef(null);
  const { content } = useContent();
  const eyebrow = useText("home.testimonials.eyebrow", "In Their Words");
  const title = useRichText("home.testimonials.title", "Stories that linger long *after the road.*");

  // Build the testimonial list from editable keys, falling back to defaults.
  const items = TESTIMONIALS.map((t, i) => ({
    quote: content[`testimonials.${i}.quote`] || t.quote,
    author: content[`testimonials.${i}.author`] || t.author,
  }));

  // Duplicate the list so the auto marquee loops seamlessly on desktop.
  const loop = [...items, ...items];

  return (
    <section className="bg-nature-deep py-24 sm:py-32 overflow-hidden" data-testid="testimonials">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 mb-14">
        <SectionHeading eyebrow={eyebrow} title={title} light className="max-w-2xl" />
      </div>
      <div
        ref={ref}
        className="flex gap-6 px-5 sm:px-8 overflow-x-auto no-scrollbar snap-x snap-mandatory md:overflow-hidden"
        data-testid="testimonials-track"
      >
        <div className="flex gap-6 md:animate-marquee md:hover:[animation-play-state:paused]">
          {loop.map((t, i) => (
            <figure
              key={i}
              className="snap-center shrink-0 w-[85vw] sm:w-[420px] glass-dark rounded-sm p-9"
              data-testid={`testimonial-${i + 1}`}
            >
              <Leaf className="h-6 w-6 text-gold mb-5" />
              <blockquote className="font-display italic font-light text-cream text-xl sm:text-2xl leading-snug mb-6">
                “{t.quote}”
              </blockquote>
              <figcaption className="font-accent text-[11px] uppercase tracking-label text-nature-light">
                {t.author}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
