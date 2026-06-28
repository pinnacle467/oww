import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";
import { ChevronDown, Loader2, Image as ImageIcon } from "lucide-react";
import api from "@/lib/api";
import { HERO_SLIDES, GALLERY_ITEMS } from "@/data/content";
import { useGalleryCategories } from "@/hooks/useGalleryCategories";

// One-image-per-section slots. `fallback` is the bundled default that
// shows on the public site when nothing has been uploaded. Showing it as
// a thumbnail in the admin lets the operator see exactly what is live.
const SINGLE_SLOTS = [
  { section: "pillars-0", title: "Home — Pillar 1 image",        subtitle: "First card under \"How We Travel\"",       fallback: "/assets/images/hero/hero-03.webp" },
  { section: "pillars-1", title: "Home — Pillar 2 image",        subtitle: "Second card under \"How We Travel\"",      fallback: "/assets/images/pillar-retreat.webp" },
  { section: "pillars-2", title: "Home — Pillar 3 image",        subtitle: "Third card under \"How We Travel\"",       fallback: "/assets/images/pillar-corporate.webp" },
  { section: "immersive", title: "Home — Featured Journey backdrop", subtitle: "Full-width parallax under \"Featured Journey\"", fallback: "/assets/images/hero/hero-05.webp" },
  { section: "maleny",    title: "Home — Maleny feature image",  subtitle: "Portrait image in the Maleny retreat section", fallback: "/assets/images/pillar-retreat.webp" },
  { section: "pricing-hero", title: "Journeys page header image", subtitle: "Top of the Journeys & Pricing page",      fallback: "/assets/images/hero/hero-02.webp" },
  { section: "gallery-hero", title: "Gallery page header image", subtitle: "Top of the Gallery page",                   fallback: "/assets/images/gallery/gallery-04.webp" },
  { section: "blog-hero",    title: "Blog page header image",    subtitle: "Top of the /blog index page",                fallback: "/assets/images/hero/hero-03.webp" },
  { section: "contact-hero", title: "Contact page header image", subtitle: "Top of the Contact page",                   fallback: "/assets/images/hero/hero-04.webp" },
  { section: "contact-bg",   title: "Contact page form backdrop", subtitle: "Ambient image behind the contact form",    fallback: "/assets/images/pillar-retreat.webp" },
  { section: "about-hero",   title: "About page header image",    subtitle: "Top of the About Us page",                  fallback: "/assets/images/hero/hero-03.webp" },
];

// Multi-image collections. `defaults` is the bundled list shown when the
// section is empty in the DB so the operator can see what is live.
function buildMultiSlots(galleryCategories) {
  return [
    {
      section: "hero",
      title: "Home — Hero Slideshow",
      subtitle: "The large rotating photos at the very top of your home page.",
      defaults: HERO_SLIDES,
      ordered: true,
    },
    {
      section: "gallery",
      title: "Gallery — Photos & Videos",
      subtitle: "Every photo and video shown on the Gallery page, with sections.",
      defaults: GALLERY_ITEMS,
      categories: galleryCategories,
    },
  ];
}

function ThumbStrip({ items, fallback }) {
  if (items && items.length > 0) {
    return (
      <div className="flex gap-2 flex-wrap mt-3 sm:mt-0 sm:max-w-[420px]">
        {items.slice(0, 6).map((it) => (
          it.file_type === "video"
            ? <video key={it.id || it.src} src={it.file_url || it.src} className="h-14 w-20 rounded-md object-cover bg-black border border-gray-200" muted playsInline />
            : <img key={it.id || it.src} src={it.file_url || it.src} alt="" className="h-14 w-20 rounded-md object-cover border border-gray-200" />
        ))}
        {items.length > 6 && (
          <span className="h-14 w-20 rounded-md border border-dashed border-gray-300 flex items-center justify-center text-sm text-gray-500 bg-gray-50">
            +{items.length - 6}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 sm:mt-0">
      <img src={fallback} alt="" className="h-14 w-24 rounded-md object-cover border border-dashed border-gray-300 opacity-75" />
    </div>
  );
}

function SingleSlotCard({ slot, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [items, setItems] = useState(null);

  const load = () => {
    api.get("/admin/media", { params: { section: slot.section } })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  };
  useEffect(() => { load(); }, [slot.section]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = items && items.length > 0 ? items : null;
  // After seeding, every section has at least one row, so live is essentially
  // always non-null. The fallback render below is kept defensive in case an
  // operator deletes every item in a section.
  const sourceLabel = live ? `${live.length} uploaded` : "Showing bundled default";

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-5" data-testid={`media-slot-${slot.section}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 text-left"
        data-testid={`media-slot-toggle-${slot.section}`}
      >
        <div className="flex-1 min-w-0">
          <span className="block text-xl font-semibold text-[#1C1C1C]">{slot.title}</span>
          <span className="block text-sm text-gray-500 mt-0.5 truncate">
            {slot.subtitle} <span className="ml-1 text-[#4A7C6F]">• {sourceLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThumbStrip items={live} fallback={slot.fallback} />
          <ChevronDown className={`h-6 w-6 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-200 px-6 py-6">
          <MediaManager
            section={slot.section}
            title=""
            subtitle="Upload an image or video. The first one in the list will appear on the website."
            ordered
          />
        </div>
      )}
    </div>
  );
}

function MultiSlotCard({ slot, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/admin/media", { params: { section: slot.section } })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, [slot.section]);

  const live = items && items.length > 0 ? items : null;
  const sourceLabel = live ? `${live.length} uploaded` : `${slot.defaults.length} defaults shown`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-5" data-testid={`media-multi-${slot.section}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 text-left"
        data-testid={`media-multi-toggle-${slot.section}`}
      >
        <div className="flex-1 min-w-0">
          <span className="block text-xl font-semibold text-[#1C1C1C]">{slot.title}</span>
          <span className="block text-sm text-gray-500 mt-0.5 truncate">
            {slot.subtitle} <span className="ml-1 text-[#4A7C6F]">• {sourceLabel}</span>
          </span>
        </div>
        <ThumbStrip items={live || slot.defaults} fallback={slot.defaults[0]?.src} />
        <ChevronDown className={`h-6 w-6 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-gray-200 px-6 py-6">
          <MediaManager
            section={slot.section}
            title=""
            subtitle={slot.ordered
              ? "Add up to five photos or videos. The first one appears first on the public page."
              : "Add as many photos or videos as you like. Set a category so the right filter shows it on the Gallery page."}
            categories={slot.categories}
            ordered={slot.ordered}
            filterable={!!slot.categories}
          />
        </div>
      )}
    </div>
  );
}

export default function WebsiteMedia() {
  useEffect(() => { document.title = "Website Images & Videos | Once Were Wild Admin"; }, []);
  const { categories } = useGalleryCategories();
  const MULTI_SLOTS = buildMultiSlots(categories);

  return (
    <AdminShell>
      <div data-testid="website-media-page">
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">Website Images & Videos</h1>
        <p className="text-lg text-gray-500 mb-7">
          Every photo and video on your website lives here. Each section shows the image that is live right now. Click a section to upload a new one and it will appear on the website on the next reload.
        </p>

        <h2 className="text-xl font-semibold text-[#1C1C1C] mb-3 mt-2 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-[#4A7C6F]" /> Image collections
        </h2>
        {MULTI_SLOTS.map((s, i) => (
          <MultiSlotCard key={s.section} slot={s} defaultOpen={i === 0} />
        ))}

        <h2 className="text-xl font-semibold text-[#1C1C1C] mb-3 mt-8 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-[#4A7C6F]" /> Single image sections
        </h2>
        {SINGLE_SLOTS.map((s) => (
          <SingleSlotCard key={s.section} slot={s} defaultOpen={false} />
        ))}
      </div>
    </AdminShell>
  );
}
