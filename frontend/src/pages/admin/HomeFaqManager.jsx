import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Eye, EyeOff, X } from "lucide-react";

// /admin/home-faqs - Questions Gently Answered manager. Mirrors the
// about_blocks admin pattern (CRUD + reorder + visibility toggle) but the
// answer field uses the shared TipTap rich-text editor so the client can
// add links and emphasis without learning HTML.

const EMPTY_FAQ = { question: "", answer: "", is_visible: true };

export default function HomeFaqManager() {
  useEffect(() => { document.title = "Home FAQs | Once Were Wild Admin"; }, []);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // FAQ object being edited in drawer
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_FAQ);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/home-faqs");
      setItems(data || []);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Could not load FAQs");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setDraft(EMPTY_FAQ); setCreating(true); setEditing(null); };
  const openEdit = (f) => { setDraft({ question: f.question, answer: f.answer, is_visible: !!f.is_visible }); setEditing(f); setCreating(false); };
  const closeDrawer = () => { setEditing(null); setCreating(false); setDraft(EMPTY_FAQ); };

  const save = async () => {
    if (!draft.question.trim()) { alert("Question is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/home-faqs/${editing.id}`, draft);
      } else {
        await api.post("/admin/home-faqs", draft);
      }
      await load();
      closeDrawer();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (f) => {
    if (!window.confirm(`Delete this question?\n\n"${f.question}"`)) return;
    try { await api.delete(`/admin/home-faqs/${f.id}`); await load(); }
    catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Delete failed"); }
  };

  const toggleVisible = async (f) => {
    try { await api.patch(`/admin/home-faqs/${f.id}`, { is_visible: !f.is_visible }); await load(); }
    catch (e) { alert(formatApiError(e?.response?.data?.detail) || "Toggle failed"); }
  };

  const move = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const newOrder = [...items];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    setItems(newOrder);
    try { await api.post("/admin/home-faqs/reorder", { ids: newOrder.map((i) => i.id) }); }
    catch (e) { alert("Reorder failed, refreshing"); await load(); }
  };

  return (
    <AdminShell>
      <div className="max-w-5xl" data-testid="home-faq-manager">
        <p className="text-base text-gray-500">Home page</p>
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">Questions Gently Answered</h1>
        <p className="text-base text-gray-500 mt-2 mb-8 max-w-2xl">
          The FAQ accordion shown on the home page. Click a row to edit the question and answer. Toggle the eye icon to hide a question without deleting it.
        </p>

        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">{items.length} question{items.length === 1 ? "" : "s"}</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors text-sm"
            data-testid="home-faq-add"
          >
            <Plus className="h-4 w-4" /> Add question
          </button>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 text-sm">
            No questions yet. Click &quot;Add question&quot; to write the first one.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((f, idx) => (
              <div key={f.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3" data-testid={`home-faq-row-${f.id}`}>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => move(idx, +1)} disabled={idx === items.length - 1} className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#1C1C1C] truncate">{f.question || "(untitled)"}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{stripHtml(f.answer)}</div>
                </div>
                <button
                  onClick={() => toggleVisible(f)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${f.is_visible ? "text-[#2D4A3E] bg-[#2D4A3E]/5" : "text-gray-500 bg-gray-100"}`}
                  title={f.is_visible ? "Visible on the home page" : "Hidden"}
                >
                  {f.is_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {f.is_visible ? "Visible" : "Hidden"}
                </button>
                <button onClick={() => openEdit(f)} className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50" data-testid={`home-faq-edit-${f.id}`}>Edit</button>
                <button onClick={() => deleteRow(f)} className="text-xs px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50" data-testid={`home-faq-delete-${f.id}`}>
                  <Trash2 className="h-3 w-3 inline mr-1" />Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {(creating || editing) && (
          <Drawer
            title={editing ? "Edit question" : "New question"}
            onClose={closeDrawer}
            saving={saving}
            onSave={save}
            draft={draft}
            setDraft={setDraft}
          />
        )}
      </div>
    </AdminShell>
  );
}

function Drawer({ title, onClose, saving, onSave, draft, setDraft }) {
  return (
    <div className="fixed inset-0 z-50 flex" data-testid="home-faq-drawer">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-[#1C1C1C]">{title}</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
            <input
              type="text"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. Are your tours women-only?"
              data-testid="home-faq-question-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Answer</label>
            <RichTextEditor
              value={draft.answer}
              onChange={(html) => setDraft({ ...draft, answer: html })}
              placeholder="Write the answer. Use the toolbar for bold, italic, lists and links."
              testIdPrefix="home-faq-answer"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!draft.is_visible}
              onChange={(e) => setDraft({ ...draft, is_visible: e.target.checked })}
            />
            Show this question on the home page
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded text-sm hover:bg-[#1F3329] disabled:opacity-60"
            data-testid="home-faq-save"
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
