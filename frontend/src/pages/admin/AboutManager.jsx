import { useEffect, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Eye, EyeOff, Upload, Image as ImageIcon, X } from "lucide-react";

// /admin/about — manages the text blocks AND the stories shown on the public
// /about page. Two stacked panels: top = blocks, bottom = stories.

const EMPTY_BLOCK = { kind: "paragraph", text: "", is_visible: true };
const EMPTY_STORY = {
  title: "",
  region: "",
  date: "",
  excerpt: "",
  body: "",
  is_visible: true,
};

export default function AboutManager() {
  useEffect(() => { document.title = "About | Once Were Wild Admin"; }, []);

  return (
    <AdminShell>
      <div className="max-w-5xl" data-testid="about-manager">
        <p className="text-base text-gray-500">About page</p>
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">About Us & Stories</h1>
        <p className="text-base text-gray-500 mt-2 mb-10 max-w-2xl">
          Everything on the public <span className="font-medium">/about</span> page is editable here.
          The hero image is managed under <span className="font-medium">Website Images & Videos → Section &quot;about-hero&quot;</span>.
        </p>

        <BlocksPanel />
        <div className="h-12" />
        <StoriesPanel />
      </div>
    </AdminShell>
  );
}

// ----------------- Blocks (text body) -----------------
function BlocksPanel() {
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_BLOCK);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/admin/about-blocks");
      setItems(data || []);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Could not load blocks");
    }
  };
  useEffect(() => { load(); }, []);

  const updateLocal = (id, patch) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const saveRow = async (b) => {
    setSavingId(b.id);
    try {
      await api.patch(`/admin/about-blocks/${b.id}`, { kind: b.kind, text: b.text, is_visible: !!b.is_visible });
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (b) => {
    if (!window.confirm("Delete this text block?")) return;
    try { await api.delete(`/admin/about-blocks/${b.id}`); await load(); }
    catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Delete failed"); }
  };

  const move = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const newOrder = [...items];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    setItems(newOrder);
    try { await api.post("/admin/about-blocks/reorder", { ids: newOrder.map((i) => i.id) }); }
    catch (e) { alert("Reorder failed — refreshing"); await load(); }
  };

  const create = async () => {
    if (!draft.text.trim()) { alert("Text is required"); return; }
    try {
      await api.post("/admin/about-blocks", draft);
      setDraft(EMPTY_BLOCK); setCreating(false); await load();
    } catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Create failed"); }
  };

  return (
    <section data-testid="about-blocks-panel">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-[#1C1C1C]">Text blocks</h2>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors text-sm"
            data-testid="add-block-btn"
          ><Plus className="h-4 w-4" /> Add block</button>
        )}
      </div>
      {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {creating && (
        <div className="mb-6 bg-white rounded-lg border-2 border-[#2D4A3E] p-5" data-testid="new-block-form">
          <div className="flex items-center gap-3 mb-3">
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              data-testid="new-block-kind"
            >
              <option value="paragraph">Paragraph</option>
              <option value="heading">Heading</option>
            </select>
          </div>
          <textarea
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            rows={draft.kind === "heading" ? 2 : 5}
            placeholder={draft.kind === "heading" ? "Section heading" : "Write your paragraph..."}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            data-testid="new-block-text"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={create} className="px-4 py-2 bg-[#2D4A3E] text-white rounded text-sm hover:bg-[#1F3329]" data-testid="save-new-block">Save block</button>
            <button onClick={() => { setCreating(false); setDraft(EMPTY_BLOCK); }} className="px-4 py-2 border border-gray-300 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && !creating && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">No blocks yet. Click &quot;Add block&quot; to write your first paragraph.</div>
        )}
        {items.map((b, idx) => (
          <div key={b.id} className="bg-white rounded-lg border border-gray-200 p-4" data-testid={`block-${b.id}`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1 pt-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(idx, +1)} disabled={idx === items.length - 1} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <select value={b.kind} onChange={(e) => updateLocal(b.id, { kind: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-xs">
                    <option value="paragraph">Paragraph</option>
                    <option value="heading">Heading</option>
                  </select>
                  <button
                    onClick={() => updateLocal(b.id, { is_visible: !b.is_visible })}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${b.is_visible ? "text-[#2D4A3E] bg-[#2D4A3E]/5" : "text-gray-500 bg-gray-100"}`}
                    title={b.is_visible ? "Visible" : "Hidden"}
                  >{b.is_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{b.is_visible ? "Visible" : "Hidden"}</button>
                </div>
                <textarea
                  value={b.text}
                  onChange={(e) => updateLocal(b.id, { text: e.target.value })}
                  rows={b.kind === "heading" ? 2 : 5}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  data-testid={`block-text-${b.id}`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => saveRow(b)} disabled={savingId === b.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2D4A3E] text-white rounded text-xs hover:bg-[#1F3329] disabled:opacity-60"
                  data-testid={`save-block-${b.id}`}
                ><Save className="h-3 w-3" />Save</button>
                <button onClick={() => deleteRow(b)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50"
                  data-testid={`delete-block-${b.id}`}
                ><Trash2 className="h-3 w-3" />Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ----------------- Stories panel -----------------
function StoriesPanel() {
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_STORY);
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputs = useRef({});

  const load = async () => {
    const { data } = await api.get("/admin/stories");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const updateLocal = (id, patch) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const saveRow = async (s) => {
    setSavingId(s.id);
    try {
      await api.patch(`/admin/stories/${s.id}`, {
        title: s.title, region: s.region, date: s.date,
        excerpt: s.excerpt, body: s.body, is_visible: !!s.is_visible,
      });
      await load();
    } catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Save failed"); }
    finally { setSavingId(null); }
  };

  const deleteRow = async (s) => {
    if (!window.confirm(`Delete story "${s.title}"? This cannot be undone.`)) return;
    try { await api.delete(`/admin/stories/${s.id}`); await load(); }
    catch (e) { alert("Delete failed"); }
  };

  const move = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const newOrder = [...items];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    setItems(newOrder);
    try { await api.post("/admin/stories/reorder", { ids: newOrder.map((i) => i.id) }); }
    catch (e) { alert("Reorder failed — refreshing"); await load(); }
  };

  const create = async () => {
    if (!draft.title.trim()) { alert("Title is required"); return; }
    try {
      await api.post("/admin/stories", draft);
      setDraft(EMPTY_STORY); setCreating(false); await load();
    } catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Create failed"); }
  };

  const uploadCover = async (s, file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert("Image is too large. Max 15 MB."); return; }
    setUploadingId(s.id);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/admin/stories/${s.id}/cover`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
    } catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Cover upload failed"); }
    finally { setUploadingId(null); }
  };

  const removeCover = async (s) => {
    if (!window.confirm(`Remove the cover image from "${s.title}"? The image file will be deleted from the server.`)) return;
    try {
      await api.delete(`/admin/stories/${s.id}/cover`);
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Could not remove cover");
    }
  };

  return (
    <section data-testid="stories-panel">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-[#1C1C1C]">Stories</h2>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors text-sm"
            data-testid="add-story-btn"
          ><Plus className="h-4 w-4" /> Add story</button>
        )}
      </div>

      {creating && (
        <div className="mb-6 bg-white rounded-lg border-2 border-[#2D4A3E] p-5" data-testid="new-story-form">
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title *" className="border border-gray-300 rounded px-3 py-2 text-sm" data-testid="new-story-title" />
            <input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} placeholder="Region (e.g. Tasmania)" className="border border-gray-300 rounded px-3 py-2 text-sm" />
            <input value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} placeholder="Date (e.g. March 2025)" className="border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <textarea value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} rows={2} placeholder="Excerpt (1-2 lines shown on the card)" className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-3" />
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} placeholder="Full story body (shown under 'Read story')" className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-3" />
          <div className="mt-3 flex gap-2">
            <button onClick={create} className="px-4 py-2 bg-[#2D4A3E] text-white rounded text-sm hover:bg-[#1F3329]" data-testid="save-new-story">Save story</button>
            <button onClick={() => { setCreating(false); setDraft(EMPTY_STORY); }} className="px-4 py-2 border border-gray-300 rounded text-sm">Cancel</button>
          </div>
          <p className="text-xs text-gray-500 mt-3">After saving, upload a cover image from the story card below.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.length === 0 && !creating && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">No stories yet. Click &quot;Add story&quot; to write your first.</div>
        )}
        {items.map((s, idx) => (
          <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-5" data-testid={`story-${s.id}`}>
            <div className="flex items-start gap-4">
              <div className="flex flex-col gap-1 pt-2 shrink-0">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(idx, +1)} disabled={idx === items.length - 1} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
              </div>

              {/* Cover preview + upload */}
              <div className="w-44 shrink-0">
                <div className="aspect-[16/10] rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                  {s.cover_url ? (
                    <img src={s.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon className="h-8 w-8" /></div>
                  )}
                </div>
                <input
                  ref={(el) => (fileInputs.current[s.id] = el)}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadCover(s, e.target.files?.[0])}
                  data-testid={`story-cover-input-${s.id}`}
                />
                <button
                  onClick={() => fileInputs.current[s.id]?.click()}
                  disabled={uploadingId === s.id}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-60"
                  data-testid={`upload-cover-${s.id}`}
                ><Upload className="h-3 w-3" />{uploadingId === s.id ? "Uploading..." : (s.cover_url ? "Replace cover" : "Upload cover")}</button>
                {s.cover_url && (
                  <button
                    onClick={() => removeCover(s)}
                    className="mt-1.5 w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50"
                    data-testid={`remove-cover-${s.id}`}
                  ><Trash2 className="h-3 w-3" />Remove cover</button>
                )}
              </div>

              {/* Editable fields */}
              <div className="flex-1 min-w-0">
                <div className="grid sm:grid-cols-3 gap-2">
                  <input value={s.title} onChange={(e) => updateLocal(s.id, { title: e.target.value })} placeholder="Title" className="border border-gray-300 rounded px-3 py-2 text-sm sm:col-span-3" />
                  <input value={s.region || ""} onChange={(e) => updateLocal(s.id, { region: e.target.value })} placeholder="Region" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                  <input value={s.date || ""} onChange={(e) => updateLocal(s.id, { date: e.target.value })} placeholder="Date" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                  <button
                    onClick={() => updateLocal(s.id, { is_visible: !s.is_visible })}
                    className={`inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded ${s.is_visible ? "text-[#2D4A3E] bg-[#2D4A3E]/5" : "text-gray-500 bg-gray-100"}`}
                  >{s.is_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{s.is_visible ? "Visible" : "Hidden"}</button>
                </div>
                <textarea value={s.excerpt || ""} onChange={(e) => updateLocal(s.id, { excerpt: e.target.value })} rows={2} placeholder="Excerpt" className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-2" />
                <textarea value={s.body || ""} onChange={(e) => updateLocal(s.id, { body: e.target.value })} rows={6} placeholder="Full story body" className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-2" />
                <div className="mt-3 flex gap-2">
                  <button onClick={() => saveRow(s)} disabled={savingId === s.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2D4A3E] text-white rounded text-xs hover:bg-[#1F3329] disabled:opacity-60" data-testid={`save-story-${s.id}`}><Save className="h-3 w-3" />Save</button>
                  <button onClick={() => deleteRow(s)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50" data-testid={`delete-story-${s.id}`}><Trash2 className="h-3 w-3" />Delete</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
