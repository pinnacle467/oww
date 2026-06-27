import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";
import { useGalleryCategories } from "@/hooks/useGalleryCategories";
import api, { formatApiError } from "@/lib/api";
import { Plus, Edit2, Trash2, Check, X, Loader2, Folder } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ------------------- Category manager (add / rename / delete) -------------------
function CategoryManager({ categories, refresh }) {
  // `categories` is the full admin-editable list (the legacy reserved "All"
  // tab has been removed; the API now returns only real categories).
  const editable = categories;
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (next) => {
    setBusy(true);
    setError("");
    try {
      await api.put("/admin/gallery-categories", { categories: next });
      await refresh();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    if (editable.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" already exists.`);
      return;
    }
    setAdding(true);
    await save([...editable, name]);
    setAdding(false);
    setNewName("");
  };

  const renameCategory = async (idx) => {
    const oldName = editable[idx];
    const newNameTrim = draftName.trim();
    if (!newNameTrim || newNameTrim === oldName) {
      setEditingIdx(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/gallery-categories/rename", { old: oldName, new: newNameTrim });
      await refresh();
      setEditingIdx(null);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async () => {
    const next = editable.filter((c) => c !== toDelete);
    setToDelete(null);
    await save(next);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-7" data-testid="category-manager">
      <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3">
        <Folder className="h-5 w-5 text-[#4A7C6F]" />
        <h2 className="text-xl font-semibold text-[#1C1C1C]">Gallery sections</h2>
        <span className="text-sm text-gray-500">— sections appear as filter pills on your public Gallery page.</span>
      </div>
      <div className="px-6 py-5">
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-2.5 text-sm" data-testid="category-error">{error}</div>}

        <ul className="divide-y divide-gray-100 mb-5" data-testid="category-list">
          {editable.map((c, idx) => (
            <li key={c} className="flex items-center gap-3 py-3" data-testid={`category-row-${idx}`}>
              {editingIdx === idx ? (
                <>
                  <input
                    autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameCategory(idx); if (e.key === "Escape") setEditingIdx(null); }}
                    className="flex-1 text-base rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-[#2D4A3E]"
                    data-testid={`category-edit-input-${idx}`}
                  />
                  <button onClick={() => renameCategory(idx)} disabled={busy}
                    className="flex items-center gap-1.5 bg-[#4A7C6F] text-white text-sm font-medium rounded-md px-3 py-2 hover:bg-[#3a6357] disabled:opacity-60"
                    data-testid={`category-save-${idx}`}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                  </button>
                  <button onClick={() => setEditingIdx(null)} className="bg-gray-100 text-gray-700 text-sm font-medium rounded-md px-3 py-2 hover:bg-gray-200"
                    data-testid={`category-cancel-${idx}`}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-base text-[#1C1C1C]" data-testid={`category-name-${idx}`}>{c}</span>
                  <button onClick={() => { setEditingIdx(idx); setDraftName(c); }}
                    className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-md px-3 py-2 hover:bg-gray-200"
                    data-testid={`category-rename-${idx}`}>
                    <Edit2 className="h-4 w-4" /> Rename
                  </button>
                  <button onClick={() => setToDelete(c)}
                    className="flex items-center gap-1.5 bg-red-50 text-[#D32F2F] text-sm font-medium rounded-md px-3 py-2 hover:bg-red-100"
                    data-testid={`category-delete-${idx}`}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </>
              )}
            </li>
          ))}
          {editable.length === 0 && (
            <li className="py-3 text-base text-gray-500">No sections yet. Add your first one below.</li>
          )}
        </ul>

        <div className="flex items-center gap-3">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
            placeholder="New section name, e.g. South America"
            className="flex-1 text-base rounded-md border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2D4A3E]"
            data-testid="new-category-input"
          />
          <button onClick={addCategory} disabled={!newName.trim() || adding}
            className="flex items-center gap-2 bg-[#4A7C6F] text-white text-base font-medium rounded-md px-5 py-2.5 hover:bg-[#3a6357] disabled:opacity-60"
            data-testid="add-category-btn">
            {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Add section
          </button>
        </div>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid="delete-category-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Remove "{toDelete}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Photos and videos in this section will keep their files, but their section tag will become blank — re-assign them to another section any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCategory} className="bg-[#D32F2F] hover:bg-[#b62626] text-base" data-testid="confirm-delete-category">
              Yes, remove section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------- Page ----------------------------
export default function GalleryManager() {
  useEffect(() => { document.title = "Gallery Photos & Videos | Once Were Wild Admin"; }, []);
  const { categories, refresh } = useGalleryCategories();

  return (
    <AdminShell>
      <CategoryManager categories={categories} refresh={refresh} />
      <MediaManager
        key={categories.join("|")}  /* remount when categories change so the dropdown rebuilds cleanly */
        section="gallery"
        title="Gallery Photos & Videos"
        subtitle="Add, replace or remove the photos and videos shown on your Gallery page. Pick the section that matches where the moment was captured."
        categories={categories}
        filterable
      />
    </AdminShell>
  );
}
