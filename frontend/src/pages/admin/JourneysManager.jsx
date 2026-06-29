import { useEffect, useState, useRef, useMemo } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { MultiMediaPicker } from "@/components/admin/MultiMediaPicker";
import {
  Plus, Trash2, Save, Upload, Download, X, ChevronUp, ChevronDown,
  Star, StarOff, ExternalLink, Copy, Eye, GripVertical,
} from "lucide-react";

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

// Trip cards on the public /pricing and /corporate-retreats pages. Each row
// in this manager is one card. B2 adds: filter tabs (Tours vs Corporate
// Retreats), a 3-section body editor, a gallery picker, a Duplicate button
// and a Preview button per row.

const EMPTY_DRAFT = {
  name: "",
  region: "",
  nights: "",
  dates: "",
  priceFrom: "",
  priceUnit: "",
  priceNote: "",
  summary: "",
  includes: "",   // newline-joined string in the form, split on save
  excludes: "International and domestic airfares\nTravel insurance\nVisa fees (if applicable)\nPersonal expenses\nOptional activities not listed in the itinerary",   // C4 — newline-joined string in the form, split on save
  highlights: "",  // Z1 — newline-joined string in the form, split on save. Drives the sidebar checkmark list on /tours/<slug>.
  cta: "Enquire",
  popular: false,
  is_active: true,
  // B1 sub-page fields - drive /tours/<slug> detail pages and the nav dropdown.
  slug: "",
  hero_media_id: "",
  seo_title: "",
  seo_description: "",
  status: "published",
  type: "tour",
  // B2 fields
  description_html: "",
  itinerary_html: "",
  practical_html: "",
  gallery_media_ids: [],   // array of media.id values, ordered
  // C5 — "More Details" rich-text block
  more_details_html: "",
};

function includesToArray(text) {
  return (text || "").split("\n").map((s) => s.trim()).filter(Boolean);
}

function includesToText(arr) {
  return Array.isArray(arr) ? arr.join("\n") : (arr || "");
}

const TYPE_LABEL = { tour: "Tour", retreat: "Corporate Retreat" };

export default function JourneysManager() {
  const [items, setItems] = useState([]);
  const [allMedia, setAllMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("tour"); // "tour" | "retreat"
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT, type: "tour" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data }, { data: mediaData }] = await Promise.all([
        api.get("/admin/journeys"),
        api.get("/media").catch(() => ({ data: [] })),
      ]);
      setItems(data.map((d) => ({
        ...d,
        _includesText: includesToText(d.includes),
        _excludesText: includesToText(d.excludes),
        _highlightsText: includesToText(d.highlights),
        gallery_media_ids: Array.isArray(d.gallery_media_ids) ? d.gallery_media_ids : [],
      })));
      setAllMedia(Array.isArray(mediaData) ? mediaData : []);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Could not load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateLocal = (id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  // Filter to the active tab. Legacy rows with no type are treated as tours.
  const visibleItems = useMemo(() => {
    return items.filter((j) => {
      const t = j.type || "tour";
      return t === activeTab;
    });
  }, [items, activeTab]);

  const saveRow = async (j) => {
    setSavingId(j.id);
    try {
      await api.patch(`/admin/journeys/${j.id}`, {
        name: j.name,
        region: j.region,
        nights: j.nights,
        dates: j.dates,
        priceFrom: j.priceFrom,
        priceUnit: j.priceUnit,
        priceNote: j.priceNote,
        summary: j.summary,
        includes: includesToArray(j._includesText),
        excludes: includesToArray(j._excludesText),
        highlights: includesToArray(j._highlightsText),
        cta: j.cta,
        popular: !!j.popular,
        is_active: !!j.is_active,
        // B1 sub-page fields
        slug: j.slug || "",
        hero_media_id: j.hero_media_id || "",
        seo_title: j.seo_title || "",
        seo_description: j.seo_description || "",
        status: j.status || "published",
        type: j.type || "tour",
        // B2 fields
        description_html: j.description_html || "",
        itinerary_html: j.itinerary_html || "",
        practical_html: j.practical_html || "",
        gallery_media_ids: Array.isArray(j.gallery_media_ids) ? j.gallery_media_ids : [],
        // C5 — More Details rich text
        more_details_html: j.more_details_html || "",
      });
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (j) => {
    if (!window.confirm(`Delete trip "${j.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/journeys/${j.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Delete failed");
    }
  };

  const duplicateRow = async (j) => {
    if (!window.confirm(`Duplicate "${j.name}" as a new draft?`)) return;
    try {
      await api.post(`/admin/journeys/${j.id}/duplicate`);
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Duplicate failed");
    }
  };

  const previewRow = async (j) => {
    try {
      const { data } = await api.post(`/admin/journeys/${j.id}/preview-token`);
      const path = (data.type === "retreat" ? "/corporate-retreats/" : "/tours/") + data.slug;
      const url = `${path}?preview=${encodeURIComponent(data.preview_token)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Could not generate preview link");
    }
  };

  // Move a row up/down WITHIN the currently-visible tab. We compute the new
  // ordering across all items so the server-side sort_order stays consistent
  // even when retreat rows are interleaved with tour rows.
  const move = async (j, dir) => {
    const visIdx = visibleItems.findIndex((it) => it.id === j.id);
    const targetVisIdx = visIdx + dir;
    if (targetVisIdx < 0 || targetVisIdx >= visibleItems.length) return;
    const targetItem = visibleItems[targetVisIdx];
    const newOrder = [...items];
    const a = newOrder.findIndex((it) => it.id === j.id);
    const b = newOrder.findIndex((it) => it.id === targetItem.id);
    [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];
    setItems(newOrder);
    try {
      await api.post("/admin/journeys/reorder", { ids: newOrder.map((it) => it.id) });
    } catch (e) {
      alert("Reorder failed - refreshing");
      await load();
    }
  };

  const togglePopular = async (j) => {
    try {
      for (const other of items) {
        if (other.id !== j.id && other.popular && (other.type || "tour") === (j.type || "tour")) {
          await api.patch(`/admin/journeys/${other.id}`, { popular: false });
        }
      }
      await api.patch(`/admin/journeys/${j.id}`, { popular: !j.popular });
      await load();
    } catch (e) {
      alert("Could not toggle popular flag");
    }
  };

  const createJourney = async () => {
    if (!draft.name.trim()) {
      alert("Name is required");
      return;
    }
    try {
      const payload = {
        ...draft,
        includes: includesToArray(draft.includes),
        excludes: includesToArray(draft.excludes),
        highlights: includesToArray(draft.highlights),
      };
      await api.post("/admin/journeys", payload);
      setDraft({ ...EMPTY_DRAFT, type: activeTab });
      setCreating(false);
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Create failed");
    }
  };

  const fileInputs = useRef({});
  const uploadPdf = async (j, file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("PDF is too large. Maximum 25 MB.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/admin/journeys/${j.id}/itinerary`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "PDF upload failed");
    }
  };
  const removePdf = async (j) => {
    if (!window.confirm("Remove the uploaded itinerary PDF?")) return;
    try {
      await api.delete(`/admin/journeys/${j.id}/itinerary`);
      await load();
    } catch (e) {
      alert("Could not remove PDF");
    }
  };

  const switchTab = (next) => {
    if (next === activeTab) return;
    setActiveTab(next);
    setCreating(false);
    setDraft({ ...EMPTY_DRAFT, type: next });
  };

  return (
    <AdminShell>
      <div className="max-w-5xl" data-testid="journeys-manager">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-base text-gray-500">Trips, tours and retreats</p>
            <h1 className="text-3xl font-semibold text-[#1C1C1C]">Trips & Journeys</h1>
            <p className="text-base text-gray-500 mt-2 max-w-2xl">
              Manage every trip and corporate retreat on the site. Switch tabs to filter by type.
              Tours appear on <span className="font-medium">/pricing</span> and the Tours nav dropdown;
              Corporate Retreats appear on <span className="font-medium">/corporate-retreats</span> and the Retreats nav dropdown.
            </p>
          </div>
          {!creating && (
            <button
              onClick={() => { setDraft({ ...EMPTY_DRAFT, type: activeTab }); setCreating(true); }}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors"
              data-testid="add-journey-btn"
            >
              <Plus className="h-4 w-4" /> Add a {TYPE_LABEL[activeTab].toLowerCase()}
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          {(["tour", "retreat"]).map((t) => {
            const count = items.filter((j) => (j.type || "tour") === t).length;
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={
                  "px-5 py-3 -mb-px text-sm font-medium border-b-2 transition-colors " +
                  (active
                    ? "text-[#2D4A3E] border-[#2D4A3E]"
                    : "text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300")
                }
                data-testid={`journeys-tab-${t}`}
              >
                {t === "tour" ? "Tours" : "Corporate Retreats"}
                <span className="ml-2 text-xs text-gray-400">({count})</span>
              </button>
            );
          })}
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded">{error}</div>}

        {/* Create draft */}
        {creating && (
          <div className="mb-8 bg-white rounded-lg border-2 border-[#2D4A3E] p-6" data-testid="new-journey-form">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#1C1C1C]">New {TYPE_LABEL[draft.type || "tour"].toLowerCase()}</h2>
              <button onClick={() => { setCreating(false); setDraft({ ...EMPTY_DRAFT, type: activeTab }); }} className="text-gray-500 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DraftFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} allMedia={allMedia} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setCreating(false); setDraft({ ...EMPTY_DRAFT, type: activeTab }); }} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={createJourney} className="px-5 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329]">
                Add {TYPE_LABEL[draft.type || "tour"].toLowerCase()}
              </button>
            </div>
          </div>
        )}

        {/* Existing rows */}
        {loading ? (
          <div className="text-gray-500">Loading trips...</div>
        ) : visibleItems.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-10 text-center text-gray-500">
            No {activeTab === "tour" ? "tours" : "corporate retreats"} yet. Click &quot;Add a {TYPE_LABEL[activeTab].toLowerCase()}&quot; to create the first one.
          </div>
        ) : (
          <div className="space-y-5">
            {visibleItems.map((j, idx) => (
              <div key={j.id} className="bg-white rounded-lg border border-gray-200 p-6" data-testid={`journey-row-${j.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1" data-testid={`reorder-${j.id}`}>
                      <button
                        type="button"
                        onClick={() => move(j, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        aria-label="Move up"
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:border-[#2D4A3E] hover:text-[#2D4A3E] hover:bg-[#FAF7F2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(j, 1)}
                        disabled={idx === visibleItems.length - 1}
                        title="Move down"
                        aria-label="Move down"
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:border-[#2D4A3E] hover:text-[#2D4A3E] hover:bg-[#FAF7F2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">#{idx + 1}</span>
                      <h2 className="text-2xl font-semibold text-[#1C1C1C]">{j.name || "(untitled)"}</h2>
                      {j.status === "draft" && <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 tracking-widest uppercase">Draft</span>}
                      {j.popular && <span className="text-xs px-2 py-1 rounded bg-[#B8923D] text-white tracking-widest uppercase">Most popular</span>}
                      {!j.is_active && <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 tracking-widest uppercase">Hidden</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => previewRow(j)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#2E6DA4] border border-[#2E6DA4]/40 rounded hover:bg-[#2E6DA4] hover:text-white"
                      title="Open this row in a new tab (preview includes drafts)"
                      data-testid={`preview-journey-${j.id}`}
                    >
                      <Eye className="h-4 w-4" /> Preview
                    </button>
                    <button
                      onClick={() => duplicateRow(j)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
                      title="Clone this row to a fresh draft"
                      data-testid={`duplicate-journey-${j.id}`}
                    >
                      <Copy className="h-4 w-4" /> Duplicate
                    </button>
                    <button onClick={() => togglePopular(j)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#B8923D] border border-[#B8923D]/50 rounded hover:bg-[#B8923D] hover:text-white">
                      {j.popular ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      {j.popular ? "Remove highlight" : "Mark popular"}
                    </button>
                    <button onClick={() => deleteRow(j)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>

                <DraftFields
                  value={{
                    name: j.name || "", region: j.region || "", nights: j.nights || "",
                    dates: j.dates || "", priceFrom: j.priceFrom || "", priceUnit: j.priceUnit || "",
                    priceNote: j.priceNote || "", summary: j.summary || "",
                    includes: j._includesText || "",
                    excludes: j._excludesText || "",
                    highlights: j._highlightsText || "",
                    cta: j.cta || "Enquire",
                    popular: !!j.popular, is_active: !!j.is_active,
                    slug: j.slug || "", hero_media_id: j.hero_media_id || "",
                    seo_title: j.seo_title || "", seo_description: j.seo_description || "",
                    status: j.status || "published",
                    type: j.type || "tour",
                    description_html: j.description_html || "",
                    itinerary_html: j.itinerary_html || "",
                    practical_html: j.practical_html || "",
                    more_details_html: j.more_details_html || "",
                    gallery_media_ids: Array.isArray(j.gallery_media_ids) ? j.gallery_media_ids : [],
                  }}
                  onChange={(p) => {
                    if (p.includes !== undefined) return updateLocal(j.id, { _includesText: p.includes });
                    if (p.excludes !== undefined) return updateLocal(j.id, { _excludesText: p.excludes });
                    if (p.highlights !== undefined) return updateLocal(j.id, { _highlightsText: p.highlights });
                    return updateLocal(j.id, p);
                  }}
                  rowId={j.id}
                  allMedia={allMedia}
                />

                {j.slug && (
                  <div className="mt-3 -mb-2">
                    <a
                      href={`${(j.type || "tour") === "retreat" ? "/corporate-retreats/" : "/tours/"}${j.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-[#2E6DA4] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View {(j.type || "tour") === "retreat" ? `/corporate-retreats/${j.slug}` : `/tours/${j.slug}`}
                    </a>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="text-base font-medium text-gray-700 mb-2">Itinerary PDF (optional)</div>
                  {j.itinerary_url ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <a href={j.itinerary_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF7F2] border border-[#B8923D]/40 rounded text-[#2D4A3E] hover:bg-[#B8923D]/10">
                        <Download className="h-4 w-4" />
                        {j.itinerary_filename || "Open PDF"}
                      </a>
                      <button onClick={() => fileInputs.current[j.id]?.click()} className="text-sm text-[#2E6DA4] hover:underline">Replace</button>
                      <button onClick={() => removePdf(j)} className="text-sm text-red-600 hover:underline">Remove</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputs.current[j.id]?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF7F2] border border-dashed border-gray-300 rounded text-gray-700 hover:border-[#2D4A3E] hover:text-[#2D4A3E]"
                    >
                      <Upload className="h-4 w-4" /> Upload itinerary (PDF, max 25 MB)
                    </button>
                  )}
                  <input
                    ref={(el) => { fileInputs.current[j.id] = el; }}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadPdf(j, f); }}
                  />
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => saveRow(j)}
                    disabled={savingId === j.id}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] disabled:opacity-60"
                    data-testid={`save-journey-${j.id}`}
                  >
                    <Save className="h-4 w-4" /> {savingId === j.id ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Field({ label, k, value, onChange, hint, colSpan, ...rest }) {
  return (
    <label className={`block ${colSpan === 2 ? "sm:col-span-2" : ""}`}>
      <span className="block text-sm font-medium text-gray-600 mb-1">{label}</span>
      <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40"
        value={value || ""}
        onChange={(e) => onChange({ [k]: e.target.value })}
        {...rest}
      />
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

// Section wrapper used by DraftFields so each block of fields is clearly
// labelled with "where it shows up" copy. Matches the new Z layout on the
// public site so the operator's mental model maps 1-1 with what they see
// on /pricing and /tours/<slug>.
function Section({ title, subtitle, children, testid }) {
  return (
    <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-[#FAFAF7] p-5" data-testid={testid}>
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-base font-semibold text-[#1C1C1C]">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function DraftFields({ value, onChange, rowId, allMedia }) {
  const isRetreat = (value.type || "tour") === "retreat";
  const detailPath = isRetreat ? `/corporate-retreats/${value.slug || "..."}` : `/tours/${value.slug || "..."}`;
  return (
    <div className="grid sm:grid-cols-2 gap-5">

      {/* ── 1. Card on /pricing ────────────────────────────────────────── */}
      <Section
        title="Card on the Tours listing"
        subtitle={`Drives the small image card with the gold name banner on ${isRetreat ? "/corporate-retreats" : "/pricing"}. The whole card is clickable and opens ${detailPath}.`}
        testid={`section-card-${rowId || "new"}`}
      >
        <Field label="Trip name *" k="name" value={value.name} onChange={onChange} hint="Shown as the big heading on the card and the H1 on the detail page." />
        <Field label="Region (small eyebrow above name)" k="region" value={value.region} onChange={onChange} placeholder="e.g. Sunshine Coast Hinterland" hint="Small uppercase label inside the gold banner." />
        <Field
          label="Hero image media ID"
          k="hero_media_id"
          value={value.hero_media_id}
          onChange={onChange}
          placeholder="Copy a media id from /admin/website-media"
          colSpan={2}
          hint="The photo at the top of the card. Until set, the card shows a monogram placeholder. The same image also opens the hero carousel on the detail page when no gallery is uploaded."
        />
      </Section>

      {/* ── 2. Tour Detail header (title subtitle + italic quote) ──────── */}
      <Section
        title="Detail page header"
        subtitle={`Powers the title row and the italic quote box sitting between the hero photo and the tab strip on ${detailPath}.`}
        testid={`section-header-${rowId || "new"}`}
      >
        <Field label="Duration / subtitle" k="nights" value={value.nights} onChange={onChange} placeholder="e.g. 7 nights" hint='Shows under the H1, joined with "Small Group Tour" or "Corporate Retreat".' />
        <Field label="Card / CTA button text" k="cta" value={value.cta} onChange={onChange} placeholder="Enquire" hint="Used as the Enquire button label on the detail page." />
        <label className="sm:col-span-2 block">
          <span className="block text-sm font-medium text-gray-600 mb-1">Short summary (1-2 sentences)</span>
          <textarea
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40"
            value={value.summary || ""}
            onChange={(e) => onChange({ summary: e.target.value })}
            placeholder="Intimate small group odysseys across Australia's most breathtaking states."
          />
          <span className="block text-xs text-gray-500 mt-1">Used as the italic quote on the detail page (fallback when no rich description is set) and for the SEO meta description by default.</span>
        </label>
        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-gray-600 mb-1">Rich description (replaces the summary in the italic quote when set)</span>
          <RichTextEditor
            value={value.description_html || ""}
            onChange={(html) => onChange({ description_html: html })}
            placeholder="Tell the story of this trip in 2-4 sentences."
            testIdPrefix={`journey-description-${rowId || "new"}`}
          />
        </div>
      </Section>

      {/* ── 3. Tab: Details (itinerary outline + more details + PDF) ──── */}
      <Section
        title='Tab: "Details"'
        subtitle="Renders inside the Details tab on the detail page. Per client direction, keep the on-page content as an OUTLINE; the full day-by-day belongs in the PDF (upload below the form)."
        testid={`section-details-${rowId || "new"}`}
      >
        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-gray-600 mb-1">Itinerary outline</span>
          <RichTextEditor
            value={value.itinerary_html || ""}
            onChange={(html) => onChange({ itinerary_html: html })}
            placeholder="Bullet list or a short day-by-day overview. The full day-by-day stays in the PDF."
            testIdPrefix={`journey-itinerary-${rowId || "new"}`}
          />
          <span className="block text-xs text-gray-500 mt-1">Keep this short. Visitors who want the full plan click the PDF download button.</span>
        </div>
        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-gray-600 mb-1">More Details / Destination story (optional)</span>
          <RichTextEditor
            value={value.more_details_html || ""}
            onChange={(html) => onChange({ more_details_html: html })}
            placeholder="Rich destination context: history, food culture, what makes this special. Supports bold, italic, headings, lists and inline images."
            testIdPrefix={`journey-more-details-${rowId || "new"}`}
          />
        </div>
        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-gray-600 mb-1">Practical information (optional)</span>
          <RichTextEditor
            value={value.practical_html || ""}
            onChange={(html) => onChange({ practical_html: html })}
            placeholder="What to bring, fitness level, dietary notes, anything practical."
            testIdPrefix={`journey-practical-${rowId || "new"}`}
          />
        </div>
      </Section>

      {/* ── 4. Tab: Gallery ───────────────────────────────────────────── */}
      <Section
        title='Tab: "Gallery"'
        subtitle="The photos shown in the hero carousel at the top of the detail page AND inside the Gallery tab. Tab auto-hides when this is empty."
        testid={`section-gallery-${rowId || "new"}`}
      >
        <div className="sm:col-span-2">
          <MultiMediaPicker
            value={value.gallery_media_ids}
            onChange={(ids) => onChange({ gallery_media_ids: ids })}
            allMedia={allMedia || []}
            rowId={rowId}
            label="Photo gallery"
            description="Drag thumbnails to reorder. Up to 30 images recommended. The first image becomes the hero photo if no separate hero is set."
            allowVideos={false}
            allowEmbeds={false}
          />
        </div>
      </Section>

      {/* ── 5. Tab: What's Included ───────────────────────────────────── */}
      <Section
        title={'Tab: "What\u2019s Included"'}
        subtitle="Two-column list inside the What's Included tab. Tab auto-hides when both lists are empty."
        testid={`section-includes-${rowId || "new"}`}
      >
        <label className="sm:col-span-2 block">
          <span className="block text-sm font-medium text-gray-600 mb-1">{"What\u2019s included (one item per line)"}</span>
          <textarea
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 font-mono text-sm"
            value={value.includes || ""}
            onChange={(e) => onChange({ includes: e.target.value })}
            placeholder={"Premium, peaceful accommodation\nBespoke dining by an accomplished chef\nAustralian wines paired with dinner"}
            data-testid={`journey-includes-${rowId || "new"}`}
          />
        </label>
        <label className="sm:col-span-2 block">
          <span className="block text-sm font-medium text-gray-600 mb-1">{"What\u2019s not included (one item per line)"}</span>
          <textarea
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 font-mono text-sm"
            value={value.excludes || ""}
            onChange={(e) => onChange({ excludes: e.target.value })}
            placeholder={"International and domestic airfares\nTravel insurance\nVisa fees (if applicable)\nPersonal expenses\nOptional activities not listed in the itinerary"}
            data-testid={`journey-excludes-${rowId || "new"}`}
          />
          <span className="block text-xs text-gray-500 mt-1">Defaults are pre-populated. Edit, add or remove items per tour.</span>
        </label>
      </Section>

      {/* ── 6. Tab: Prices & Dates ────────────────────────────────────── */}
      <Section
        title={'Tab: "Prices & Dates"'}
        subtitle="Pricing and date cards inside the Prices & Dates tab. Tab auto-hides when both Price headline and Dates are blank."
        testid={`section-prices-${rowId || "new"}`}
      >
        <Field label="Price headline" k="priceFrom" value={value.priceFrom} onChange={onChange} placeholder="From $4,200" hint="The big number shown in the price card." />
        <Field label="Price unit (small)" k="priceUnit" value={value.priceUnit} onChange={onChange} placeholder="per person, twin share" />
        <Field label="Price note (smallest)" k="priceNote" value={value.priceNote} onChange={onChange} placeholder="Single from $4,750 per person" colSpan={2} />
        <Field label="Dates" k="dates" value={value.dates} onChange={onChange} placeholder="e.g. 22 to 28 November 2026" colSpan={2} hint="Shown in the date card alongside the duration." />
      </Section>

      {/* ── 7. Sidebar: Tour highlights ───────────────────────────────── */}
      <Section
        title="Sidebar: Tour highlights"
        subtitle="Checkmark list shown in the right-hand sidebar on the detail page. The whole panel hides when this is empty."
        testid={`section-highlights-${rowId || "new"}`}
      >
        <label className="sm:col-span-2 block">
          <span className="block text-sm font-medium text-gray-600 mb-1">Highlights (one item per line)</span>
          <textarea
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 font-mono text-sm"
            value={value.highlights || ""}
            onChange={(e) => onChange({ highlights: e.target.value })}
            placeholder={"7 days / 6 nights with breakfast included\n4 wine tastings at local wineries\n9 guided sightseeing experiences\nEnglish speaking guide\nPrivate driver and car\nExperienced Travel Director at your arrangement"}
            data-testid={`journey-highlights-${rowId || "new"}`}
          />
          <span className="block text-xs text-gray-500 mt-1">Keep each item to a short line. They are rendered with a gold check mark.</span>
        </label>
      </Section>

      {/* ── 8. URL + visibility + SEO ─────────────────────────────────── */}
      <Section
        title="URL, visibility & SEO"
        subtitle="The address of the detail page, whether the public can see it, and what shows up in search results / browser tabs."
        testid={`section-seo-${rowId || "new"}`}
      >
        <Field label="URL slug (auto if blank)" k="slug" value={value.slug} onChange={onChange} placeholder="e.g. tasmanian-tour" hint={`Detail page will live at ${detailPath}.`} />
        <label className="block">
          <span className="block text-sm font-medium text-gray-600 mb-1">Type</span>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 bg-white"
            value={value.type || "tour"}
            onChange={(e) => onChange({ type: e.target.value })}
          >
            <option value="tour">Tour (appears on /pricing)</option>
            <option value="retreat">Corporate Retreat (appears on /corporate-retreats)</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-600 mb-1">Status</span>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 bg-white"
            value={value.status || "published"}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="published">Published (visible)</option>
            <option value="draft">Draft (hidden, preview only)</option>
          </select>
        </label>
        <label className="flex items-center gap-3 mt-1">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!value.is_active}
            onChange={(e) => onChange({ is_active: e.target.checked })}
          />
          <span className="text-sm text-gray-700">Show on the public listing</span>
        </label>
        <Field label="SEO title (browser tab)" k="seo_title" value={value.seo_title} onChange={onChange} placeholder="Falls back to trip name" colSpan={2} />
        <label className="sm:col-span-2 block">
          <span className="block text-sm font-medium text-gray-600 mb-1">SEO meta description</span>
          <textarea
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40"
            value={value.seo_description || ""}
            onChange={(e) => onChange({ seo_description: e.target.value })}
            placeholder="Falls back to the summary above. Aim for 140 to 160 characters."
          />
        </label>
      </Section>
    </div>
  );
}
