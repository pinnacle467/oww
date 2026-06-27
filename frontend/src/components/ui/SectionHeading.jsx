import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function SectionHeading({ eyebrow, title, light = false, align = "left", className }) {
  return (
    <div className={cn(align === "center" && "text-center mx-auto", className)}>
      {eyebrow && (
        <ScrollReveal>
          <p className={cn("label-eyebrow mb-5", light ? "text-gold" : "text-nature-mid")}>{eyebrow}</p>
        </ScrollReveal>
      )}
      <ScrollReveal delay={80}>
        <h2
          className={cn(
            "font-display font-light leading-[1.05] tracking-tight text-3xl sm:text-4xl lg:text-5xl",
            light ? "text-cream" : "text-ink"
          )}
        >
          {title}
        </h2>
      </ScrollReveal>
    </div>
  );
}

export default SectionHeading;
