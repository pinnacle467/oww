import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { MultiMediaPicker } from "@/components/admin/MultiMediaPicker";
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Eye, EyeOff, X } from "lucide-react";

// /admin/home-content - long-form rich-text sections shown on the home page.
// Same pattern as Home FAQs but the field is heading + body instead of
// question + answer, and the body uses TipTap for headings/lists/links.

const EMPTY_SECTION = { heading: "", body: "", is_visible: true, media_ids: [] };

export default function HomeContentManager() {
  useEffect(() => { document.title = "Home Content | Once Were Wild Admin"; }, []);
  const [items, setItems] = useState([]);
  const [allMedia, setAllMedia] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_SECTION);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [itemsRes, mediaRes] = await Promise.all([
        api.get("/admin/home-sections"),
        api.get("/media"),
      ]);
      setItems(itemsRes.data || []);
      setAllMedia(mediaRes.data || []);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Could not load sections");
    } finally {
      setLoading(false);
    }
  };
  const loadMedia = async () => {
    try {
      const { data } = await api.get("/media");
      setAllMedia(data || []);
    } catch (_) { /* non-fatal */ }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setDraft(EMPTY_SECTION); setCreating(true); setEditing(null); };
  const openEdit = (s) => {
    setDraft({
      heading: s.heading || "",
      body: s.body || "",
      is_visible: !!s.is_visible,
      media_ids: Array.isArray(s.media_ids) ? s.media_ids : [],
    });
    setEditing(s);
    setCreating(false);
  };
  const closeDrawer = () => { setEditing(null); setCreating(false); setDraft(EMPTY_SECTION); };

  const save = async () => {
    if (!draft.heading.trim() && !draft.body.trim()) { alert("Heading or body is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/home-sections/${editing.id}`, draft);
      } else {
        await api.post("/admin/home-sections", draft);
      }
      await load();
      closeDrawer();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (s) => {
    if (!window.confirm(`Delete this section?\n\n"${s.heading || "(untitled)"}"`)) return;
    try { await api.delete(`/admin/home-sections/${s.id}`); await load(); }
    catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Delete failed"); }
  };

  const toggleVisible = async (s) => {
    try { await api.patch(`/admin/home-sections/${s.id}`, { is_visible: !s.is_visible }); await load(); }
    catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Toggle failed"); }
  };

  const move = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const newOrder = [...items];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    setItems(newOrder);
    try { await api.post("/admin/home-sections/reorder", { ids: newOrder.map((i) => i.id) }); }
    catch (e) { alert("Reorder failed, refreshing"); await load(); }
  };

  return (
    <AdminShell>
      <div className="max-w-5xl" data-testid="home-content-manager">
        <p className="text-base text-gray-500">Home page</p>
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">Home Content Sections</h1>
        <p className="text-base text-gray-500 mt-2 mb-8 max-w-2xl">
          Long-form rich-text sections shown in the lower half of the home page (the &quot;Slow stories&quot; area). Add sections with H2 headings and paragraphs for SEO and storytelling. Each section can be reordered and hidden without being deleted.
        </p>

        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">{items.length} section{items.length === 1 ? "" : "s"}</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors text-sm"
            data-testid="home-content-add"
          >
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 text-sm">
            No sections yet. Click &quot;Add section&quot; to write the first one.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3" data-testid={`home-section-row-${s.id}`}>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => move(idx, +1)} disabled={idx === items.length - 1} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#1C1C1C] truncate">{s.heading || "(untitled)"}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{stripHtml(s.body)}</div>
                </div>
                <button
                  onClick={() => toggleVisible(s)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${s.is_visible ? "text-[#2D4A3E] bg-[#2D4A3E]/5" : "text-gray-500 bg-gray-100"}`}
                  title={s.is_visible ? "Visible on the home page" : "Hidden"}
                >
                  {s.is_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {s.is_visible ? "Visible" : "Hidden"}
                </button>
                <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50" data-testid={`home-section-edit-${s.id}`}>Edit</button>
                <button onClick={() => deleteRow(s)} className="text-xs px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50" data-testid={`home-section-delete-${s.id}`}>
                  <Trash2 className="h-3 w-3 inline mr-1" />Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {(creating || editing) && (
          <Drawer
            title={editing ? "Edit section" : "New section"}
            onClose={closeDrawer}
            saving={saving}
            onSave={save}
            draft={draft}
            setDraft={setDraft}
            allMedia={allMedia}
            onReloadMedia={loadMedia}
            editingId={editing?.id}
          />
        )}
      </div>
    </AdminShell>
  );
}

function Drawer({ title, onClose, saving, onSave, draft, setDraft, allMedia, onReloadMedia, editingId }) {
  return (
    <div className="fixed inset-0 z-50 flex" data-testid="home-content-drawer">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-3xl bg-white shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-[#1C1C1C]">{title}</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Section heading (H2)</label>
            <input
              type="text"
              value={draft.heading}
              onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. Why Slow Travel?"
              data-testid="home-section-heading-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
            <RichTextEditor
              value={draft.body}
              onChange={(html) => setDraft({ ...draft, body: html })}
              placeholder="Write the body. Use the toolbar for headings, bold, italic, lists, images and links."
              testIdPrefix="home-section-body"
            />
          </div>

          {/* Phase 3 - optional inline gallery shown above the body via SwipeableMedia */}
          <div className="pt-3 border-t border-gray-200">
            <MultiMediaPicker
              value={draft.media_ids}
              onChange={(ids) => setDraft({ ...draft, media_ids: ids })}
              allMedia={allMedia || []}
              rowId={editingId || "new-section"}
              label="Section gallery (optional)"
              description="Add images, MP4 videos or YouTube / Vimeo URLs. When set, a swipeable gallery renders above the section body. Drag to reorder. A single item renders as a plain image."
              allowVideos={true}
              allowEmbeds={true}
              allowUpload={true}
              allowDelete={true}
              uploadSection="home-gallery"
              reloadMedia={onReloadMedia}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!draft.is_visible}
              onChange={(e) => setDraft({ ...draft, is_visible: e.target.checked })}
            />
            Show this section on the home page
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded text-sm hover:bg-[#1F3329] disabled:opacity-60"
            data-testid="home-section-save"
          >
            <Save className="h-4 w-4" />{saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function stripHtml(html) {
  if (!html) return "";
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || div.innerText || "").trim();
  } catch (_e) {
    return "";
  }
}
