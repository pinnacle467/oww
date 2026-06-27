import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { useContent } from "@/context/ContentContext";
import { ChevronDown, Loader2, Save, Check, ExternalLink } from "lucide-react";

const GROUP_LABELS = {
  brand: "Brand",
  nav: "Navigation",
  home: "Home page",
  pricing: "Journeys & Pricing page",
  journeys: "Journey details",
  faqs: "Frequently asked questions",
  gallery: "Gallery page",
  contact: "Contact page",
  pillars: "Experience pillars",
  testimonials: "Testimonials",
  footer: "Footer",
  seo: "SEO & search visibility",
};
const GROUP_ORDER = ["brand", "nav", "home", "pricing", "journeys", "faqs", "gallery", "contact", "pillars", "testimonials", "footer", "seo"];

// Where each text group renders on the public site. Used by the
// "Preview on site" pill in each group header.
const GROUP_PREVIEW_TARGETS = {
  brand:    { path: "/",         label: "View on home" },
  nav:      { path: "/",         label: "View navigation" },
  home:     { path: "/",         label: "Preview home page" },
  pricing:  { path: "/pricing",  label: "Preview Journeys page" },
  journeys: { path: "/pricing",  label: "Preview Journey cards" },
  faqs:     { path: "/pricing#faq-accordion", label: "Preview FAQs" },
  gallery:  { path: "/gallery",  label: "Preview Gallery page" },
  pillars:  { path: "/",         label: "Preview on home" },
  testimonials: { path: "/",     label: "Preview on home" },
  contact:  { path: "/contact",  label: "Preview Contact page" },
  footer:   { path: "/",         label: "Preview footer" },
  seo:      { path: "/",         label: "View site" },
};

function GroupCard({ groupKey, items, onSave, defaultOpen, previewTarget }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState(() => Object.fromEntries(items.map((i) => [i.key, i.value])));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(Object.fromEntries(items.map((i) => [i.key, i.value])));
  }, [items]);

  const dirty = items.some((i) => (draft[i.key] ?? "") !== (i.value ?? ""));

  const save = async () => {
    const changes = items
      .filter((i) => (draft[i.key] ?? "") !== (i.value ?? ""));
    if (!changes.length) return;
    const payload = changes.map((i) => ({ key: i.key, value: draft[i.key] ?? "" }));
    const previous = Object.fromEntries(changes.map((i) => [i.key, i.value]));

    setSaving(true);
    // OPTIMISTIC: paint "Saved" immediately and apply the patch to the
    // public-site content store, so admins see the result the moment they
    // click the button (no 300ms "is it saving?" guess).
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
    const ok = await onSave(payload, previous);
    setSaving(false);
    if (!ok) setSaved(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-5" data-testid={`text-group-${groupKey}`}>
      <div className="w-full flex items-center justify-between gap-3 px-6 py-5">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-3 text-left"
          data-testid={`text-group-toggle-${groupKey}`}
        >
          <span className="flex-1">
            <span className="block text-xl font-semibold text-[#1C1C1C]">{GROUP_LABELS[groupKey] || groupKey}</span>
            <span className="block text-sm text-gray-500 mt-0.5">{items.length} editable fields</span>
          </span>
          <ChevronDown className={`h-6 w-6 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {previewTarget && (
          <a
            href={previewTarget.path}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#2D4A3E]/25 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2D4A3E] hover:bg-[#2D4A3E] hover:text-white transition-colors"
            data-testid={`preview-group-${groupKey}`}
            title={previewTarget.label}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Preview on site
          </a>
        )}
      </div>
      {open && (
        <div className="border-t border-gray-200 px-6 py-6 space-y-5">
          {items.map((i) => (
            <div key={i.key} data-testid={`text-field-${i.key}`}>
              <label className="block text-base font-medium text-[#1C1C1C] mb-1.5" htmlFor={`f-${i.key}`}>
                {i.label || i.key}
              </label>
              <p className="text-xs text-gray-500 mb-2 font-mono">{i.key}</p>
              {(i.type === "richtext" || (i.value || "").length > 80) ? (
                <textarea
                  id={`f-${i.key}`}
                  rows={Math.min(8, Math.max(3, Math.ceil((draft[i.key] || "").length / 90)))}
                  className="w-full text-base rounded-md border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2D4A3E] resize-y leading-relaxed"
                  value={draft[i.key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [i.key]: e.target.value })}
                  data-testid={`input-${i.key}`}
                />
              ) : (
                <input
                  id={`f-${i.key}`}
                  className="w-full text-base rounded-md border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2D4A3E]"
                  value={draft[i.key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [i.key]: e.target.value })}
                  data-testid={`input-${i.key}`}
                />
              )}
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && (
              <span className="text-green-700 flex items-center gap-1.5 text-sm" data-testid={`saved-${groupKey}`}>
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="flex items-center gap-2 bg-[#4A7C6F] text-white text-lg font-medium rounded-md px-7 py-3 hover:bg-[#3a6357] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`save-group-${groupKey}`}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WebsiteText() {
  useEffect(() => { document.title = "Website Text | Once Were Wild Admin"; }, []);
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { refresh } = useContent();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/content");
      setGroups(data || {});
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (items, onPutOk) => {
    if (!items.length) return true;
    try {
      await api.put("/admin/content", { items });
      if (onPutOk) onPutOk();
      await load();
      await refresh();
      return true;
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
      return false;
    }
  };

  const orderedKeys = [
    ...GROUP_ORDER.filter((k) => groups[k]),
    ...Object.keys(groups).filter((k) => !GROUP_ORDER.includes(k)),
  ];

  return (
    <AdminShell>
      <div data-testid="website-text-page">
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">Website Text</h1>
        <p className="text-lg text-gray-500 mb-7">
          Every word on your website, in one place. Edit any field and click <span className="font-semibold text-[#4A7C6F]">Save changes</span>.
          Wrap a phrase in <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">*stars*</span> to make it italic.
        </p>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3" data-testid="text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="h-7 w-7 animate-spin text-[#2D4A3E] mx-auto" /></div>
        ) : (
          orderedKeys.map((g, i) => (
            <GroupCard
              key={g}
              groupKey={g}
              items={groups[g]}
              onSave={save}
              defaultOpen={i === 0}
              previewTarget={GROUP_PREVIEW_TARGETS[g]}
            />
          ))
        )}
      </div>
    </AdminShell>
  );
}
