import { useEffect } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";

export default function HeroManager() {
  useEffect(() => { document.title = "Hero Slideshow | Once Were Wild Admin"; }, []);
  return (
    <AdminShell>
      <MediaManager
        section="hero"
        title="Hero Slideshow"
        subtitle="These are the large rotating photos at the very top of your home page. Add up to five for the best effect. The newest order is shown left to right."
        ordered
      />
    </AdminShell>
  );
}
