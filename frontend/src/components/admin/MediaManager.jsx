import { useState, useEffect, useRef } from "react";
import api, { formatApiError } from "@/lib/api";
import { Plus, Trash2, RefreshCw, Loader2, X, Save, Check, ArrowUp, ArrowDown, CheckSquare, Square } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MediaManager({ section, title, subtitle, categories, ordered, filterable, minItems }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [banner, setBanner] = useState("");
  const [filter, setFilter] = useState(categories ? categories[0] : null);
  // Bulk upload: collected files + per-file status + the category applied to all.
  const [queue, setQueue] = useState([]); // [{file, name, status, error}]
  const [bulkCategory, setBulkCategory] = useState(categories ? categories[0] || "" : "");
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  // Bulk select-delete.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const replaceRef = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/media", { params: { section } });
      setItems(data);
    } catch (e) { setBanner(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [section]);

  const flash = (m) => { setBanner(m); setTimeout(() => setBanner(""), 2500); };

  // Bulk upload helpers
  const pickFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setQueue((q) => [
      ...q,
      ...files.map((f) => ({
        file: f,
        name: f.name,
        size: f.size,
        file_type: f.type.startsWith("video") ? "video" : "image",
        status: "pending",
        error: "",
      })),
    ]);
  };

  const removeFromQueue = (idx) => setQueue((q) => q.filter((_, i) => i !== idx));

  const submitQueue = async () => {
    if (!queue.length) { flash("Please choose one or more photos or videos first."); return; }
    setSaving(true);
    setUploadProgress({ done: 0, total: queue.length });
    let added = 0;
    const baseSort = items.length;
    // We process the queue WITHOUT keeping all data URLs in memory. Each file
    // is uploaded as a native multipart/form-data stream and freed before the
    // next one starts. This is what lets the admin upload dozens of large
    // photos without crashing the tab.
    const updated = [...queue];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "uploading", error: "" };
      setQueue([...updated]);
      try {
        const fd = new FormData();
        fd.append("section", section);
        fd.append("category", bulkCategory || "");
        fd.append("alt_text", "");
        fd.append("sort_order", String(baseSort + i));
        fd.append("file", updated[i].file);
        await api.post("/admin/media/upload", fd);
        updated[i] = { file: null, name: updated[i].name, size: updated[i].size,
          file_type: updated[i].file_type, status: "done", error: "" };
        added++;
      } catch (e) {
        updated[i] = { ...updated[i], status: "error",
          error: formatApiError(e.response?.data?.detail) || "Upload failed" };
      }
      setQueue([...updated]);
      setUploadProgress({ done: i + 1, total: updated.length });
      // Yield to the event loop so the UI redraws between uploads.
      await new Promise((r) => setTimeout(r, 0));
    }
    await load();
    setSaving(false);
    if (updated.every((q) => q.status === "done")) {
      setAdding(false);
      setQueue([]);
      flash(`Uploaded ${added} item${added === 1 ? "" : "s"}.`);
    } else {
      flash(`Uploaded ${added} of ${updated.length}. See the list for failed items.`);
    }
  };

  const updateItem = async (id, patch) => {
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const saveItem = async (item) => {
    try {
      await api.patch(`/admin/media/${item.id}`, { category: item.category });
      flash("Saved.");
    } catch (e) { flash(formatApiError(e.response?.data?.detail)); }
  };
  const replaceImage = async (id, file) => {
    if (!file) return;
    const url = await fileToDataUrl(file);
    try {
      await api.patch(`/admin/media/${id}`, { file_url: url, file_type: file.type.startsWith("video") ? "video" : "image" });
      await load();
      flash("Image replaced.");
    } catch (e) { flash(formatApiError(e.response?.data?.detail)); }
  };
  const removeItem = async () => {
    try {
      await api.delete(`/admin/media/${toRemove.id}`);
      setToRemove(null);
      await load();
      flash("Removed.");
    } catch (e) { flash(formatApiError(e.response?.data?.detail)); }
  };

  // Bulk select-delete helpers
  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = (idsInView) => {
    const all = idsInView.every((id) => selected.has(id));
    setSelected(all ? new Set() : new Set(idsInView));
  };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const removeBulk = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    let removed = 0;
    for (const id of ids) {
      try {
        await api.delete(`/admin/media/${id}`);
        removed++;
      } catch (e) {
        // keep going; report the count at the end
      }
    }
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    exitSelectMode();
    await load();
    flash(`Removed ${removed} item${removed === 1 ? "" : "s"}${removed === ids.length ? "" : ` of ${ids.length}`}.`);
  };

  // All admin-managed categories are valid upload targets (the legacy
  // categories[0] === "All" sentinel was removed; the first entry is now a
  // real category like "Maleny Retreats" and must appear in the dropdown).
  const catOptions = categories || [];

  // Keep the bulk-upload category default in sync with available options.
  useEffect(() => {
    if (!categories) return;
    setBulkCategory((c) => c || catOptions[0] || "");
  }, [categories]);

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index], b = items[target];
    const arr = [...items];
    arr[index] = b; arr[target] = a;
    setItems(arr);
    try {
      await Promise.all([
        api.patch(`/admin/media/${a.id}`, { sort_order: target }),
        api.patch(`/admin/media/${b.id}`, { sort_order: index }),
      ]);
    } catch { load(); }
  };

  // Open the Add modal and PRE-SELECT the currently filtered section so
  // uploads always land where the operator is looking.
  const openAddModal = () => {
    if (categories && filter) {
      setBulkCategory(filter);
    } else if (categories && !bulkCategory) {
      setBulkCategory(catOptions[0] || "");
    }
    setAdding(true);
  };

  return (
    <div data-testid={`media-manager-${section}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Select toggle — flips the grid into bulk-delete mode */}
          {items.length > 0 && (
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className={`flex items-center gap-2 rounded-md px-5 py-3 text-base font-medium transition-colors ${
                selectMode ? "bg-[#2D4A3E] text-white hover:bg-[#1f3a30]" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              data-testid="bulk-select-toggle"
            >
              <CheckSquare className="h-5 w-5" /> {selectMode ? "Done selecting" : "Select"}
            </button>
          )}
          <button onClick={openAddModal}
            className="flex items-center gap-2 bg-[#4A7C6F] text-white text-lg font-medium rounded-md px-6 py-3 hover:bg-[#3a6357] transition-colors"
            data-testid="add-media-btn">
            <Plus className="h-5 w-5" /> Add New
          </button>
        </div>
      </div>
      <p className="text-lg text-gray-500 mb-7">{subtitle}</p>

      {banner && <div className="mb-5 bg-green-50 border border-green-200 text-green-800 rounded-md px-4 py-3 text-base" data-testid="media-banner">{banner}</div>}

      {/* Sticky bulk-action bar shown while Select mode is on */}
      {selectMode && items.length > 0 && (
        <div className="sticky top-2 z-30 mb-5 bg-white border-2 border-[#2D4A3E] rounded-lg shadow-md px-5 py-3 flex flex-wrap items-center gap-3" data-testid="bulk-action-bar">
          <span className="text-base font-medium text-[#1C1C1C]" data-testid="bulk-selected-count">
            {selected.size} selected
          </span>
          <span className="text-gray-400">•</span>
          <button
            onClick={() => {
              const visibleIds = (filterable && categories && filter
                ? items.filter((i) => (i.category || "") === filter)
                : items).map((i) => i.id);
              selectAll(visibleIds);
            }}
            className="text-base font-medium text-[#4A7C6F] hover:text-[#2D4A3E]"
            data-testid="bulk-select-all"
          >
            {(() => {
              const visibleIds = (filterable && categories && filter
                ? items.filter((i) => (i.category || "") === filter)
                : items).map((i) => i.id);
              const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
              return allSelected ? "Clear selection" : "Select all in view";
            })()}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={selected.size === 0}
            className="flex items-center gap-2 bg-[#D32F2F] text-white rounded-md px-5 py-2.5 text-base font-medium hover:bg-[#b62626] disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="bulk-delete-btn"
          >
            <Trash2 className="h-5 w-5" /> Delete selected
          </button>
          <button
            onClick={exitSelectMode}
            className="bg-gray-100 text-gray-700 rounded-md px-4 py-2.5 text-base font-medium hover:bg-gray-200"
            data-testid="bulk-cancel"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Optional category filter pills that mirror the public site exactly */}
      {filterable && categories && (
        <div className="flex flex-wrap gap-2.5 mb-6" data-testid="admin-gallery-filters">
          {categories.map((c) => {
            const count = items.filter((i) => (i.category || "") === c).length;
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-4 py-2 font-accent text-[11px] uppercase tracking-[0.12em] transition-all duration-200 ${
                  active
                    ? "bg-[#2D4A3E] text-white"
                    : "border border-[#2D4A3E]/20 text-gray-700 hover:border-[#4A7C6F] hover:text-[#2D4A3E]"
                }`}
                data-testid={`admin-gallery-filter-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
              >
                {c} <span className={active ? "opacity-80" : "opacity-60"}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-7 w-7 animate-spin text-[#2D4A3E] mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500 text-lg">
          No photos here yet. Click <span className="font-semibold text-[#4A7C6F]">Add New</span> to upload your first one.
        </div>
      ) : (() => {
        const shown = filterable && categories && filter
          ? items.filter((i) => (i.category || "") === filter)
          : items;
        if (shown.length === 0) {
          return (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500 text-lg" data-testid="filter-empty">
              No photos in this category yet. Click <span className="font-semibold text-[#4A7C6F]">Add New</span> to add one.
            </div>
          );
        }
        return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((item, idx) => {
            const isSelected = selected.has(item.id);
            return (
            <div
              key={item.id}
              onClick={selectMode ? () => toggleSelect(item.id) : undefined}
              className={`bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-all relative ${
                selectMode ? "cursor-pointer" : ""
              } ${isSelected ? "ring-2 ring-[#2D4A3E] border-[#2D4A3E]" : "border-gray-200"}`}
              data-testid={`media-item-${item.id}`}
            >
              {/* Selection checkbox overlay */}
              {selectMode && (
                <div className="absolute top-3 left-3 z-10 pointer-events-none">
                  <div className={`h-7 w-7 rounded-md flex items-center justify-center shadow-md ${
                    isSelected ? "bg-[#2D4A3E] text-white" : "bg-white/90 text-gray-400"
                  }`} data-testid={`media-checkbox-${item.id}`}>
                    {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </div>
                </div>
              )}
              <div className="relative bg-gray-100">
                {item.file_type === "video"
                  ? (
                    item.thumb_url ? (
                      <img src={item.thumb_url} alt={item.caption || ""} className="w-full aspect-[4/3] object-cover" />
                    ) : (
                      <div
                        className="w-full aspect-[4/3] bg-gray-700"
                        style={item.lqip ? { backgroundImage: `url(${item.lqip})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                      />
                    )
                  )
                  : <img src={item.file_url} alt={item.caption || ""} className="w-full aspect-[4/3] object-cover" />}
                {item.file_type === "video" && (
                  <>
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="bg-black/55 backdrop-blur-sm rounded-full p-3 text-white shadow-lg">
                        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </span>
                    </span>
                    <span className="absolute top-2 right-2 bg-black/70 text-white text-[11px] font-medium rounded px-2 py-1 uppercase tracking-wider">Video</span>
                  </>
                )}
              </div>
              <div className="p-4 space-y-3">
                {ordered && (
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <span className="text-sm font-medium text-gray-600">Slide {idx + 1}</span>
                    <span className="flex gap-1">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0 || selectMode} className="p-1.5 rounded bg-white border border-gray-300 disabled:opacity-40 hover:bg-gray-100" data-testid={`move-up-${item.id}`} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1 || selectMode} className="p-1.5 rounded bg-white border border-gray-300 disabled:opacity-40 hover:bg-gray-100" data-testid={`move-down-${item.id}`} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                    </span>
                  </div>
                )}
                {categories && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Category</label>
                    <select value={item.category || catOptions[0]} disabled={selectMode}
                      onChange={(e) => updateItem(item.id, { category: e.target.value })}
                      className="w-full text-base rounded-md border border-gray-300 px-3 py-2 mt-1 outline-none focus:border-[#2D4A3E] disabled:opacity-60" data-testid={`category-${item.id}`}>
                      {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div className={`grid ${categories ? "grid-cols-3" : "grid-cols-2"} gap-2 pt-1`}>
                  {categories && (
                    <button onClick={() => saveItem(item)} disabled={selectMode} className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-gray-200 disabled:opacity-50" data-testid={`save-${item.id}`}>
                      <Save className="h-4 w-4" /> Save
                    </button>
                  )}
                  <button onClick={() => !selectMode && replaceRef.current[item.id]?.click()} disabled={selectMode} className="flex items-center justify-center gap-1.5 bg-[#2E6DA4] text-white rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[#255b8a] disabled:opacity-50" data-testid={`replace-${item.id}`}>
                    <RefreshCw className="h-4 w-4" /> Replace
                  </button>
                  <input ref={(el) => (replaceRef.current[item.id] = el)} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => replaceImage(item.id, e.target.files[0])} />
                  <button onClick={() => !selectMode && setToRemove(item)} disabled={selectMode} className="flex items-center justify-center gap-1.5 bg-[#D32F2F] text-white rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[#b62626] disabled:opacity-50" data-testid={`remove-${item.id}`} aria-label="Delete">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            </div>
          );})}
        </div>
        );
      })()}

      {/* Bulk-upload modal */}
      {adding && (
        <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center p-5" data-testid="add-media-modal">
          <div className="bg-white rounded-lg w-full max-w-2xl p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-semibold text-[#1C1C1C]">Add photos or videos</h2>
              <button onClick={() => { if (!saving) { setAdding(false); setQueue([]); } }} className="text-gray-400 hover:text-gray-700" disabled={saving}><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-medium text-gray-700 mb-1.5">
                  Choose one or many photos or videos
                </label>
                <input
                  type="file" accept="image/*,video/*" multiple
                  onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
                  className="w-full text-base border border-gray-300 rounded-md px-3 py-2.5"
                  data-testid="new-media-file"
                  disabled={saving}
                />
                <p className="text-sm text-gray-500 mt-1.5">Tip: hold <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs">Ctrl</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs">⌘</kbd> in the file picker to select several at once.</p>
              </div>

              {categories && (
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1.5">Category for these uploads</label>
                  <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}
                    className="w-full text-base rounded-md border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2D4A3E]" data-testid="new-media-category" disabled={saving}>
                    {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {queue.length > 0 && (
                <div className="border border-gray-200 rounded-md divide-y max-h-[40vh] overflow-y-auto" data-testid="upload-queue">
                  {queue.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 text-sm" data-testid={`queue-item-${idx}`}>
                      <span className={`shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-semibold ${
                        q.status === "done" ? "bg-green-100 text-green-700" :
                        q.status === "uploading" ? "bg-blue-100 text-blue-700" :
                        q.status === "error" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {q.status === "done" ? <Check className="h-4 w-4" /> :
                         q.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                         q.status === "error" ? "!" : idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-gray-800">{q.name}</div>
                        <div className="text-xs text-gray-500">
                          {q.file_type === "video" ? "Video" : "Image"} · {Math.round(q.size / 1024)} KB
                          {q.status === "error" && <span className="text-red-600"> · {q.error}</span>}
                          {q.status === "done" && <span className="text-green-700"> · Uploaded</span>}
                        </div>
                      </div>
                      {!saving && q.status !== "done" && (
                        <button onClick={() => removeFromQueue(idx)} className="text-gray-400 hover:text-red-600" aria-label="Remove from queue" data-testid={`queue-remove-${idx}`}>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {saving && uploadProgress.total > 0 && (
                <div data-testid="upload-progress">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#4A7C6F] transition-all duration-300" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 text-center">Uploading {uploadProgress.done} of {uploadProgress.total}…</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-7">
              <button onClick={() => { if (!saving) { setAdding(false); setQueue([]); } }} disabled={saving}
                className="flex-1 bg-gray-100 text-gray-700 rounded-md py-3 text-lg font-medium hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button onClick={submitQueue} disabled={saving || queue.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-[#4A7C6F] text-white rounded-md py-3 text-lg font-medium hover:bg-[#3a6357] disabled:opacity-60"
                data-testid="confirm-add-media">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {queue.length > 1 ? `Upload ${queue.length} files` : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single-item remove confirm */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent data-testid="remove-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              {minItems && items.length <= minItems
                ? "Remove the last image?"
                : "Remove this item?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {minItems && items.length <= minItems ? (
                <>
                  This is the <strong>last image</strong> in this section. Removing it will leave the public hero with no photos to display. We recommend adding a replacement first. Are you sure you want to delete it anyway?
                </>
              ) : (
                <>Are you sure you want to remove this image? This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={removeItem} className="bg-[#D32F2F] hover:bg-[#b62626] text-base" data-testid="confirm-remove">Yes, remove it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={(o) => !o && !bulkDeleting && setConfirmBulkDelete(false)}>
        <AlertDialogContent data-testid="bulk-remove-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Remove {selected.size} item{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              The selected photos and videos will be permanently removed from your website. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting} className="text-base">Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={removeBulk} disabled={bulkDeleting} className="bg-[#D32F2F] hover:bg-[#b62626] text-base" data-testid="confirm-bulk-remove">
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
              Yes, remove {selected.size === 1 ? "it" : "them"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MediaManager;
