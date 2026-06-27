import { useEffect, useState, useRef } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Plus, Trash2, Save, Upload, Download, X, ChevronUp, ChevronDown, Star, StarOff, ExternalLink } from "lucide-react";

// Trip cards on the public /pricing page. Each row in this manager corresponds
// to one card on the live site. Edits are saved per-row via PATCH so an
// operator can save one card at a time without losing focus on the others.

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
  cta: "Enquire",
  popular: false,
  is_active: true,
  // B1 sub-page fields - drive /tours/<slug> detail pages and the nav dropdown.
  slug: "",                // auto-generated server-side from name if blank
  hero_media_id: "",       // links to an existing /admin/website-media entry by id
  body_html: "",           // TipTap rich-text body for the sub-page
  seo_title: "",
  seo_description: "",
  status: "published",     // "draft" or "published"
};

function includesToArray(text) {
  return (text || "").split("\n").map((s) => s.trim()).filter(Boolean);
}

function includesToText(arr) {
  return Array.isArray(arr) ? arr.join("\n") : (arr || "");
}

export default function JourneysManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/journeys");
      // Normalise each row's `includes` (array) into the editable string form.
      setItems(data.map((d) => ({ ...d, _includesText: includesToText(d.includes) })));
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
        cta: j.cta,
        popular: !!j.popular,
        is_active: !!j.is_active,
        // B1 sub-page fields
        slug: j.slug || "",
        hero_media_id: j.hero_media_id || "",
        body_html: j.body_html || "",
        seo_title: j.seo_title || "",
        seo_description: j.seo_description || "",
        status: j.status || "published",
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

  const move = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const newOrder = [...items];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    setItems(newOrder);
    try {
      await api.post("/admin/journeys/reorder", { ids: newOrder.map((j) => j.id) });
    } catch (e) {
      alert("Reorder failed — refreshing");
      await load();
    }
  };

  const togglePopular = async (j) => {
    // Only one trip can be "Most Popular" at a time — clear the flag on
    // every other row first so the highlight band stays unique.
    try {
      for (const other of items) {
        if (other.id !== j.id && other.popular) {
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
      const payload = { ...draft, includes: includesToArray(draft.includes) };
      await api.post("/admin/journeys", payload);
      setDraft(EMPTY_DRAFT);
      setCreating(false);
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Create failed");
    }
  };

  // PDF upload (per row)
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

  return (
    <AdminShell>
      <div className="max-w-5xl" data-testid="journeys-manager">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-base text-gray-500">Pricing page</p>
            <h1 className="text-3xl font-semibold text-[#1C1C1C]">Trips & Journeys</h1>
            <p className="text-base text-gray-500 mt-2 max-w-2xl">
              Each row below is one trip card on your <span className="font-medium">/pricing</span> page.
              Add a new trip, change prices or details, mark one as &quot;Most Popular&quot;, and optionally
              attach a downloadable PDF itinerary that visitors can grab from the card.
              Use the <span className="font-medium">↑ / ↓ arrows</span> beside each title to reorder how the cards appear on the public page.
            </p>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors"
              data-testid="add-journey-btn"
            >
              <Plus className="h-4 w-4" /> Add a trip
            </button>
          )}
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded">{error}</div>}

        {/* Create draft */}
        {creating && (
          <div className="mb-8 bg-white rounded-lg border-2 border-[#2D4A3E] p-6" data-testid="new-journey-form">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#1C1C1C]">New trip</h2>
              <button onClick={() => { setCreating(false); setDraft(EMPTY_DRAFT); }} className="text-gray-500 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DraftFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setCreating(false); setDraft(EMPTY_DRAFT); }} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={createJourney} className="px-5 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329]">
                Add trip
              </button>
            </div>
          </div>
        )}

        {/* Existing rows */}
        {loading ? (
          <div className="text-gray-500">Loading trips…</div>
        ) : items.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-10 text-center text-gray-500">
            No trips yet. Click &quot;Add a trip&quot; to create your first one.
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((j, idx) => (
              <div key={j.id} className="bg-white rounded-lg border border-gray-200 p-6" data-testid={`journey-row-${j.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {/* Reorder controls. Clear, big-enough hit targets so
                        the operator can shuffle the trip cards without
                        squinting. Order is persisted server-side on click
                        via /admin/journeys/reorder. */}
                    <div className="flex flex-col gap-1" data-testid={`reorder-${j.id}`}>
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        aria-label="Move trip up"
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:border-[#2D4A3E] hover:text-[#2D4A3E] hover:bg-[#FAF7F2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={idx === items.length - 1}
                        title="Move down"
                        aria-label="Move trip down"
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:border-[#2D4A3E] hover:text-[#2D4A3E] hover:bg-[#FAF7F2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">#{idx + 1}</span>
                      <h2 className="text-2xl font-semibold text-[#1C1C1C]">{j.name || "(untitled)"}</h2>
                      {j.popular && <span className="text-xs px-2 py-1 rounded bg-[#B8923D] text-white tracking-widest uppercase">Most popular</span>}
                      {!j.is_active && <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 tracking-widest uppercase">Hidden</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePopular(j)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#B8923D] border border-[#B8923D]/50 rounded hover:bg-[#B8923D] hover:text-white">
                      {j.popular ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      {j.popular ? "Remove highlight" : "Mark as Most Popular"}
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
                    includes: j._includesText || "", cta: j.cta || "Enquire",
                    popular: !!j.popular, is_active: !!j.is_active,
                    slug: j.slug || "", hero_media_id: j.hero_media_id || "",
                    body_html: j.body_html || "", seo_title: j.seo_title || "",
                    seo_description: j.seo_description || "", status: j.status || "published",
                  }}
                  onChange={(p) => updateLocal(j.id, p.includes !== undefined ? { _includesText: p.includes } : p)}
                  rowId={j.id}
                />

                {/* B1 - quick link to the public sub-page so the operator can
                    review the change without leaving the admin. Only shows
                    when the row has a published slug. */}
                {j.slug && (
                  <div className="mt-3 -mb-2">
                    <a
                      href={`/tours/${j.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-[#2E6DA4] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View /tours/{j.slug}
                    </a>
                  </div>
                )}

                {/* PDF itinerary block */}
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
                    <Save className="h-4 w-4" /> {savingId === j.id ? "Saving…" : "Save changes"}
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

// Shared form fields - used for both new-trip drafts and editing existing rows.
// The "includes" textarea takes one bullet per line for natural editing.

// Defined OUTSIDE the parent so React doesn't recreate the input on every
// keystroke (which would steal focus after each character).
function Field({ label, k, value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-600 mb-1">{label}</span>
      <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40"
        value={value || ""}
        onChange={(e) => onChange({ [k]: e.target.value })}
        {...rest}
      />
    </label>
  );
}

function DraftFields({ value, onChange, rowId }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Trip name *" k="name" value={value.name} onChange={onChange} />
      <Field label="Region (eyebrow)" k="region" value={value.region} onChange={onChange} placeholder="e.g. Sunshine Coast Hinterland" />
      <Field label="Nights label" k="nights" value={value.nights} onChange={onChange} placeholder="e.g. 6 nights" />
      <Field label="Dates" k="dates" value={value.dates} onChange={onChange} placeholder="e.g. 22 to 28 November 2026" />
      <Field label="Price headline" k="priceFrom" value={value.priceFrom} onChange={onChange} placeholder="From $4,200" />
      <Field label="Price unit (small)" k="priceUnit" value={value.priceUnit} onChange={onChange} placeholder="per person, twin share" />
      <Field label="Price note (smallest)" k="priceNote" value={value.priceNote} onChange={onChange} placeholder="Single from $4,750 per person" />
      <Field label="CTA button text" k="cta" value={value.cta} onChange={onChange} placeholder="Enquire about Maleny" />
      <label className="sm:col-span-2 block">
        <span className="block text-sm font-medium text-gray-600 mb-1">Summary (1-2 sentences, shown on the trip card)</span>
        <textarea
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40"
          value={value.summary || ""}
          onChange={(e) => onChange({ summary: e.target.value })}
        />
      </label>
      <label className="sm:col-span-2 block">
        <span className="block text-sm font-medium text-gray-600 mb-1">{"What\u2019s included (one item per line)"}</span>
        <textarea
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 font-mono text-sm"
          value={value.includes || ""}
          onChange={(e) => onChange({ includes: e.target.value })}
          placeholder={"Premium, peaceful accommodation\nBespoke dining by an accomplished chef\nAustralian wines paired with dinner"}
        />
      </label>
      <label className="sm:col-span-2 flex items-center gap-3 mt-1">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={!!value.is_active}
          onChange={(e) => onChange({ is_active: e.target.checked })}
        />
        <span className="text-sm text-gray-700">Visible on the public /pricing page</span>
      </label>

      {/* ---- B1: Sub-page content for /tours/<slug> ---------------------- */}
      <div className="sm:col-span-2 mt-4 pt-5 border-t border-gray-200">
        <h3 className="text-base font-semibold text-[#1C1C1C] mb-1">Tour sub-page</h3>
        <p className="text-sm text-gray-500 mb-4">
          The standalone page at <span className="font-mono text-xs">/tours/{value.slug || "..."}</span>. Leave the body empty and the page will simply show the summary above.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="URL slug (auto if blank)" k="slug" value={value.slug} onChange={onChange} placeholder="e.g. tasmanian-tour" />
          <label className="block">
            <span className="block text-sm font-medium text-gray-600 mb-1">Status</span>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 bg-white"
              value={value.status || "published"}
              onChange={(e) => onChange({ status: e.target.value })}
            >
              <option value="published">Published (visible)</option>
              <option value="draft">Draft (hidden)</option>
            </select>
          </label>
          <Field label="Hero image media ID (optional)" k="hero_media_id" value={value.hero_media_id} onChange={onChange} placeholder="Copy a media id from /admin/website-media" />
          <Field label="SEO title (browser tab)" k="seo_title" value={value.seo_title} onChange={onChange} placeholder="Falls back to trip name" />
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
          <div className="sm:col-span-2">
            <span className="block text-sm font-medium text-gray-600 mb-1">Sub-page body (rich text)</span>
            <RichTextEditor
              value={value.body_html || ""}
              onChange={(html) => onChange({ body_html: html })}
              placeholder="The main content of the /tours/<slug> page. Use the toolbar for headings, lists, links and inline images."
              testIdPrefix={`journey-body-${rowId || "new"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
