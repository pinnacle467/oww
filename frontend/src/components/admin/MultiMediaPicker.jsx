import { useMemo, useState } from "react";
import { GripVertical, X } from "lucide-react";

// Shared admin picker: choose + reorder + remove an ordered list of
// media.id values pulled from the existing /api/media collection. Used by
// JourneysManager (tour photo galleries), BlogManager (post multi-cover)
// and HomeContentManager (section inline gallery).
//
// Props:
//   value         - current ordered array of media.id strings.
//   onChange(ids) - called with the next ordered array of ids.
//   allMedia      - the full /api/media response (array of rows).
//   rowId         - optional, used for test-id namespacing.
//   label         - heading shown above the picker (defaults to "Photo gallery").
//   description   - hint text below the heading.
//   allowVideos   - when true (default), MP4 rows are selectable too.
//   allowEmbeds   - when true (default), YouTube / Vimeo rows are selectable too.

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

const thumbUrl = (m) => {
  if (!m) return "";
  const u = m.thumb_url || m.file_url || "";
  return u && u.startsWith("/") && API_BASE ? `${API_BASE}${u}` : u;
};

export function MultiMediaPicker({
  value,
  onChange,
  allMedia,
  rowId,
  label = "Photo gallery",
  description = "Pick images from your Website Media library. Drag the thumbnails to reorder.",
  allowVideos = true,
  allowEmbeds = true,
}) {
  const [filter, setFilter] = useState("");
  const [dragId, setDragId] = useState(null);
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
  const remove = (id) => onChange(ids.filter((x) => x !== id));

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

  return (
    <div className="mt-2" data-testid={`multi-media-picker-${ns}`}>
      <h3 className="text-base font-semibold text-[#1C1C1C] mb-1">{label}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-4">{description}</p>
      )}

      {/* Selected (ordered, draggable) */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-widest text-gray-500 mb-2">
          In this gallery ({ids.length})
        </div>
        {ids.length === 0 ? (
          <div className="text-sm text-gray-400 bg-gray-50 rounded p-4 text-center" data-testid={`mmp-empty-${ns}`}>
            No items selected yet. Click thumbnails below to add.
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
                  {m && kind !== "image" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] uppercase tracking-widest text-gray-700 bg-gray-100">
                      {kind === "video" ? "MP4" : (m.embed_provider || "embed")}
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
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(id); }}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from gallery"
                    data-testid={`mmp-remove-${id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
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
            No matching media. Upload images via /admin/website-media first.
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
                  {kind === "image" ? (
                    <img src={thumbUrl(m)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] uppercase tracking-widest text-gray-700 bg-gray-100">
                      {kind === "video" ? "MP4" : (m.embed_provider || "embed")}
                    </div>
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
    </div>
  );
}

export default MultiMediaPicker;
