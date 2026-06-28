import { useEffect } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";

export default function HeroManager() {
  useEffect(() => { document.title = "Hero Carousel | Once Were Wild Admin"; }, []);
  return (
    <AdminShell>
      <MediaManager
        section="hero"
        title="Hero Carousel"
        subtitle="The large rotating photos at the very top of your home page. Add as many as you like — they auto-advance every 4.5 seconds, and visitors can use the arrow buttons and dot indicators to navigate manually. Add an alt text for accessibility on each image. We strongly recommend keeping at least one image at all times."
        ordered
        minItems={1}
      />
    </AdminShell>
  );
}
