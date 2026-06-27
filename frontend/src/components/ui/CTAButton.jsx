import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

// Variants: glass (over imagery), gold (outline), filled (nature green), ghost
const variants = {
  glass: "glass text-white hover:bg-white/20",
  gold: "border border-gold text-gold hover:bg-gold hover:text-ink bg-transparent",
  filled: "bg-nature-deep text-cream hover:bg-nature-mid",
  light: "bg-cream text-ink hover:bg-white",
  ghost: "text-ink hover:text-nature-mid bg-transparent",
};

export function CTAButton({ children, to, href, onClick, variant = "glass", className, withArrow = false, type = "button", ...props }) {
  const classes = cn(
    "group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-accent text-xs uppercase tracking-label transition-all duration-300",
    variants[variant],
    className
  );
  const inner = (
    <>
      <span>{children}</span>
      {withArrow && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
    </>
  );
  if (to) return <Link to={to} className={classes} {...props}>{inner}</Link>;
  if (href) return <a href={href} className={classes} {...props}>{inner}</a>;
  return <button type={type} onClick={onClick} className={classes} {...props}>{inner}</button>;
}

export default CTAButton;
