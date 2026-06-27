import { cn } from "@/lib/utils";

export function GlassCard({ children, className, variant = "light", ...props }) {
  const base = variant === "dark" ? "glass-dark" : variant === "solid" ? "glass-solid" : "glass";
  return (
    <div className={cn(base, "rounded-sm", className)} {...props}>
      {children}
    </div>
  );
}

export default GlassCard;
