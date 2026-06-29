import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, X, Upload, RefreshCw, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Shared admin picker: choose + reorder + remove an ordered list of
// media.id values pulled from the existing /api/media collection. Used by
// JourneysManager (tour photo galleries), BlogManager (post multi-cover)
// and HomeContentManager (section inline gallery).
//
// Props:
//   value                - current ordered array of media.id strings.
//   onChange(ids)        - called with the next ordered array of ids.
//   allMedia             - the full /api/media response (array of rows).
//   rowId                - optional, used for test-id namespacing.
//   label                - heading shown above the picker (defaults to "Photo gallery").
//   description          - hint text below the heading.
//   allowVideos          - when true (default), MP4 rows are selectable too.
//   allowEmbeds          - when true (default), YouTube / Vimeo rows are selectable too.
//   allowUpload          - when true, shows "Add new" multi-upload button + per-tile Replace.
//   uploadSection        - the media `section` tag applied to newly uploaded rows.
//                          Required when allowUpload is true. Defaults to "multimedia-gallery".
//   allowDelete          - when true, each selected tile gets a "Delete permanently" button.
//   reloadMedia          - async callback the picker invokes after upload / replace / delete
//                          so the parent can refetch /media and refresh `allMedia`.

import { BACKEND_URL as API_BASE } from "@/lib/backendUrl";

const thumbUrl = (m) => {
  if (!m) return "";
  const u = m.thumb_url || m.file_url || "";
  return u && u.startsWith("/") && API_BASE ? `${API_BASE}${u}` : u;
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MultiMediaPicker({
  value,
  onChange,
  allMedia,
  rowId,
  label = "Photo gallery",
  description = "Pick images from your Website Media library. Drag the thumbnails to reorder.",
  allowVideos = true,
  allowEmbeds = true,
  allowUpload = false,
  uploadSection = "multimedia-gallery",
  allowDelete = false,
  reloadMedia,
}) {
  const [filter, setFilter] = useState("");
  const [dragId, setDragId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]); // [{ name, size, status, error }]
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [toDelete, setToDelete] = useState(null); // media row pending permanent deletion
  const [replacingId, setReplacingId] = useState(null);
  const [banner, setBanner] = useState("");
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const ids = Array.isArray(value) ? value : [];

  const mediaMap = useMemo(() => {
    const m = {};
    (allMedia || []).forEach((x) => { m[x.id] = x; });
    return m;
  }, [allMedia]);

  const filteredAvailable = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (allMedia || [])
      .filter((m) => {
        const t = m.file_type || "image";
        if (t === "video" && !allowVideos) return false;
        if (t === "embed" && !allowEmbeds) return false;
        return true;
      })
      .filter((m) => !ids.includes(m.id))
      .filter((m) => !q ||
        (m.section || "").toLowerCase().includes(q) ||
        (m.alt || "").toLowerCase().includes(q) ||
        (m.caption || "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [allMedia, ids, filter, allowVideos, allowEmbeds]);

  const add = (id) => {
    if (ids.includes(id)) return;
    onChange([...ids, id]);
  };
  const removeFromGallery = (id) => onChange(ids.filter((x) => x !== id));

  const flashBanner = (text) => {
    setBanner(text);
    setTimeout(() => setBanner(""), 2800);
  };

  // --- Bulk upload ----------------------------------------------------------
  const onPickFiles = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const onFilesChosen = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await runUpload(files);
  };

  const runUpload = async (files) => {
    const accepted = files.filter((f) => {
      const isVideo = (f.type || "").startsWith("video/");
      const isImage = (f.type || "").startsWith("image/");
      if (isVideo && !allowVideos) return false;
      if (!isVideo && !isImage) return false;
      return true;
    });
    if (!accepted.length) {
      flashBanner(allowVideos
        ? "Only images and videos can be uploaded here."
        : "Only images can be uploaded here.");
      return;
    }
    const queue = accepted.map((f) => ({
      name: f.name, size: f.size, status: "pending", error: "", file: f,
    }));
    setUploadQueue(queue);
    setUploading(true);
    setUploadProgress({ done: 0, total: queue.length });

    const newlyUploadedIds = [];
    const updated = [...queue];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "uploading", error: "" };
      setUploadQueue([...updated]);
      try {
        const fd = new FormData();
        fd.append("section", uploadSection || "multimedia-gallery");
        fd.append("category", "");
        fd.append("alt_text", "");
        fd.append("sort_order", String(i));
        fd.append("file", updated[i].file);
        const { data } = await api.post("/admin/media/upload", fd);
        if (data?.id) newlyUploadedIds.push(data.id);
        updated[i] = { ...updated[i], file: null, status: "done", error: "" };
      } catch (err) {
        updated[i] = {
          ...updated[i],
          status: "error",
          error: formatApiError(err.response?.data?.detail) || "Upload failed",
        };
      }
      setUploadQueue([...updated]);
      setUploadProgress({ done: i + 1, total: updated.length });
      await new Promise((r) => setTimeout(r, 0));
    }
    setUploading(false);

    // Refresh the parent's allMedia, then auto-add the newly uploaded IDs to
    // the selection in the order they were uploaded.
    if (typeof reloadMedia === "function") {
      try { await reloadMedia(); } catch (_) { /* non-fatal */ }
    }
    if (newlyUploadedIds.length) {
      onChange([...ids, ...newlyUploadedIds]);
      flashBanner(`Uploaded ${newlyUploadedIds.length} item${newlyUploadedIds.length === 1 ? "" : "s"}.`);
    }
    // Keep the queue visible for a moment if any errored so the operator sees the why.
    if (updated.every((q) => q.status === "done")) {
      setTimeout(() => setUploadQueue([]), 1200);
    }
  };

  // --- Replace (binary swap on an existing media row) -----------------------
  const onPickReplace = (id) => {
    setReplacingId(id);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    replaceInputRef.current?.click();
  };

  const onReplaceFileChosen = async (e) => {
    const file = (e.target.files || [])[0];
    const id = replacingId;
    setReplacingId(null);
    if (!file || !id) return;
    const isVideo = (file.type || "").startsWith("video/");
    const isImage = (file.type || "").startsWith("image/");
    if (!isImage && !isVideo) { flashBanner("Replace with an image or a video file."); return; }
    if (isVideo && !allowVideos) { flashBanner("Videos aren't allowed here."); return; }
    try {
      const url = await fileToDataUrl(file);
      await api.patch(`/admin/media/${id}`, {
        file_url: url,
        file_type: isVideo ? "video" : "image",
      });
      if (typeof reloadMedia === "function") {
        try { await reloadMedia(); } catch (_) { /* non-fatal */ }
      }
      flashBanner("File replaced.");
    } catch (err) {
      flashBanner(formatApiError(err?.response?.data?.detail) || "Replace failed");
    }
  };

  // --- Permanent delete -----------------------------------------------------
  const confirmDelete = async () => {
    const id = toDelete?.id;
    if (!id) { setToDelete(null); return; }
    try {
      await api.delete(`/admin/media/${id}`);
      onChange(ids.filter((x) => x !== id));
      if (typeof reloadMedia === "function") {
        try { await reloadMedia(); } catch (_) { /* non-fatal */ }
      }
      flashBanner("Deleted permanently.");
    } catch (err) {
      flashBanner(formatApiError(err?.response?.data?.detail) || "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  // --- Drag reorder ---------------------------------------------------------
  const onDragStart = (id) => () => setDragId(id);
  const onDragOver = () => (e) => { e.preventDefault(); };
  const onDrop = (overId) => (e) => {
    e.preventDefault();
    if (!dragId || dragId === overId) { setDragId(null); return; }
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(overId);
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return; }
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragId);
    onChange(next);
    setDragId(null);
  };

  const ns = rowId || "new";
  const acceptAttr = allowVideos ? "image/*,video/*" : "image/*";
  const uploadVerb = allowVideos ? "photos or videos" : "photos";

  return (
    <div className="mt-2" data-testid={`multi-media-picker-${ns}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-base font-semibold text-[#1C1C1C]">{label}</h3>
        {allowUpload && (
          <button
            type="button"
            onClick={onPickFiles}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-[#2D4A3E] text-white hover:bg-[#1f3329] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid={`mmp-upload-btn-${ns}`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading..." : `Add ${uploadVerb}`}
          </button>
        )}
      </div>
      {description && (
        <p className="text-sm text-gray-500 mb-4">{description}</p>
      )}

      {allowUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            multiple
            className="hidden"
            onChange={onFilesChosen}
            data-testid={`mmp-upload-input-${ns}`}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept={acceptAttr}
            className="hidden"
            onChange={onReplaceFileChosen}
            data-testid={`mmp-replace-input-${ns}`}
          />
        </>
      )}

      {banner && (
        <div className="mb-3 px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2" data-testid={`mmp-banner-${ns}`}>
          <CheckCircle2 className="h-4 w-4" />
          <span>{banner}</span>
        </div>
      )}

      {uploadQueue.length > 0 && (
        <div className="mb-4 border border-gray-200 rounded divide-y" data-testid={`mmp-queue-${ns}`}>
          <div className="px-3 py-2 bg-gray-50 text-xs uppercase tracking-widest text-gray-500 flex items-center justify-between">
            <span>Upload progress</span>
            <span>{uploadProgress.done} / {uploadProgress.total}</span>
          </div>
          {uploadQueue.map((q, i) => (
            <div key={i} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-gray-700">{q.name}</span>
              <span className={
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs " +
                (q.status === "done" ? "bg-emerald-100 text-emerald-700" :
                 q.status === "uploading" ? "bg-blue-100 text-blue-700" :
                 q.status === "error" ? "bg-red-100 text-red-700" :
                 "bg-gray-100 text-gray-600")
              }>
                {q.status === "done" ? <CheckCircle2 className="h-3 w-3" /> :
                 q.status === "uploading" ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 q.status === "error" ? <AlertTriangle className="h-3 w-3" /> : null}
                {q.status === "error" ? (q.error || "Failed") : q.status}
              </span>
            </div>
          ))}
          {uploadProgress.total > 0 && uploadProgress.done < uploadProgress.total && (
            <div className="px-3 py-2 bg-gray-50">
              <div className="h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full bg-[#2D4A3E] transition-all duration-300"
                  style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected (ordered, draggable) */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-widest text-gray-500 mb-2">
          In this gallery ({ids.length})
        </div>
        {ids.length === 0 ? (
          <div className="text-sm text-gray-400 bg-gray-50 rounded p-4 text-center" data-testid={`mmp-empty-${ns}`}>
            No items selected yet. {allowUpload ? `Click "Add ${uploadVerb}" above, or pick existing media below.` : "Click thumbnails below to add."}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {ids.map((id) => {
              const m = mediaMap[id];
              const kind = m?.file_type || "image";
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={onDragStart(id)}
                  onDragOver={onDragOver(id)}
                  onDrop={onDrop(id)}
                  className={
                    "group relative aspect-square overflow-hidden rounded border bg-gray-100 cursor-move " +
                    (dragId === id ? "ring-2 ring-[#2D4A3E] opacity-60" : "border-gray-200")
                  }
                  data-testid={`mmp-selected-${id}`}
                >
                  {m && kind === "image" && (
                    <img src={thumbUrl(m)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  {m && kind === "video" && (
                    <>
                      {m.thumb_url ? (
                        <img src={thumbUrl(m)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-[10px] uppercase tracking-widest text-gray-700">MP4</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] uppercase tracking-widest px-1.5 py-0.5 text-center">video</div>
                    </>
                  )}
                  {m && kind === "embed" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] uppercase tracking-widest text-gray-700 bg-gray-100">
                      {m.embed_provider || "embed"}
                      <span className="mt-1 line-clamp-1 px-1 normal-case tracking-normal text-gray-500">
                        {m.caption || ""}
                      </span>
                    </div>
                  )}
                  {!m && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-red-600">missing</div>
                  )}
                  <div className="absolute top-1 left-1 bg-black/40 text-white rounded px-1.5 py-0.5 text-[10px] uppercase tracking-widest flex items-center gap-1">
                    <GripVertical className="h-3 w-3" /> drag
                  </div>
                  <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {allowUpload && m && kind !== "embed" && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPickReplace(id); }}
                        className="bg-white text-gray-700 rounded-full p-1 hover:bg-gray-100 shadow"
                        title="Replace this file"
                        data-testid={`mmp-replace-${id}`}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                    {allowDelete && m && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setToDelete(m); }}
                        className="bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                        title="Delete permanently"
                        data-testid={`mmp-delete-${id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFromGallery(id); }}
                      className="bg-gray-700 text-white rounded-full p-1 hover:bg-gray-800"
                      title="Remove from this gallery (keeps the file in Website Media)"
                      data-testid={`mmp-remove-${id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available pool */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="text-xs font-medium uppercase tracking-widest text-gray-500">Available media</div>
          <input
            type="text"
            placeholder="Filter by section, alt or caption..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-auto w-64 px-3 py-1.5 text-sm border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none"
            data-testid={`mmp-filter-${ns}`}
          />
        </div>
        {filteredAvailable.length === 0 ? (
          <div className="text-sm text-gray-400 bg-gray-50 rounded p-4 text-center">
            {allowUpload
              ? `No matching media. Click "Add ${uploadVerb}" above to upload new files.`
              : "No matching media. Upload images via /admin/website-media first."}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-80 overflow-y-auto p-2 bg-gray-50 rounded">
            {filteredAvailable.map((m) => {
              const kind = m.file_type || "image";
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => add(m.id)}
                  className="group relative aspect-square overflow-hidden rounded border border-gray-200 bg-white hover:ring-2 hover:ring-[#2D4A3E] transition-all"
                  title={m.section ? `Section: ${m.section}` : "Click to add"}
                  data-testid={`mmp-available-${m.id}`}
                >
                  {kind === "image" || (kind === "video" && m.thumb_url) ? (
                    <img src={thumbUrl(m)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] uppercase tracking-widest text-gray-700 bg-gray-100">
                      {kind === "video" ? "MP4" : (m.embed_provider || "embed")}
                    </div>
                  )}
                  {kind === "video" && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] uppercase tracking-widest px-1.5 py-0.5 text-center">video</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] uppercase tracking-widest px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-center">
                    Add
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Permanent-delete confirm dialog */}
      <AlertDialog open={!!toDelete} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent data-testid={`mmp-delete-dialog-${ns}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file from Website Media as well as from every page that references it.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`mmp-delete-cancel-${ns}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid={`mmp-delete-confirm-${ns}`}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MultiMediaPicker;
