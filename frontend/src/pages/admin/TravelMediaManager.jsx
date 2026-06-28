import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";
import api, { formatApiError } from "@/lib/api";
import { Plus, Loader2, Trash2, Youtube } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Travel Media admin (Phase 2 of Changes 1-9, item 2.2).
// Surfaces image + video uploads via the standard MediaManager (which
// already supports bulk upload, reorder, edit alt, delete) and adds a
// dedicated "Add YouTube / Vimeo URL" button below the grid so the client
// can mix photos / videos / external embeds in a single swipeable strip
// rendered on the public About Us page.
//
// Section key: "about-travel" (the existing /api/media pipeline filters by
// section so no new collection or endpoints were needed).

const SECTION = "about-travel";

function looksLikeYoutubeOrVimeo(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    return ["youtu.be", "youtube.com", "m.youtube.com", "youtube-nocookie.com",
      "vimeo.com", "player.vimeo.com"].includes(h);
  } catch {
    return false;
  }
}

function EmbedList() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toRemove, setToRemove] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/media", { params: { section: SECTION } });
      setItems((data || []).filter((m) => m.file_type === "embed"));
    } catch {
      setItems([]);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setError("");
    if (!url.trim()) { setError("Please paste a YouTube or Vimeo URL."); return; }
    if (!looksLikeYoutubeOrVimeo(url.trim())) {
      setError("Only YouTube and Vimeo URLs are supported.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/media", {
        section: SECTION,
        file_url: url.trim(),
        file_type: "embed",
        alt_text: alt.trim(),
        caption: alt.trim(),
        sort_order: 9999,
      });
      setUrl(""); setAlt(""); setOpen(false);
      await load();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || "Could not add this URL.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    try {
      await api.delete(`/admin/media/${toRemove.id}`);
      setToRemove(null);
      await load();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || "Could not remove this embed.");
    }
  };

  return (
    <div className="mt-10 bg-white rounded-lg border border-gray-200 p-6" data-testid="travel-embeds">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-semibold text-[#1C1C1C]">YouTube and Vimeo embeds</h2>
          <p className="text-sm text-gray-500">Add travel videos hosted on YouTube or Vimeo. They show up in the same swipeable gallery, mixed with your photos and uploaded videos.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-[#2D4A3E] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1f3530]"
          data-testid="travel-add-embed"
        >
          <Plus className="h-4 w-4" /> Add YouTube / Vimeo URL
        </button>
      </div>

      {error && <div className="mb-3 p-3 rounded bg-red-50 text-sm text-red-700">{error}</div>}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No embeds yet. Paste a YouTube or Vimeo URL above to add one.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.id} className="border border-gray-200 rounded-md p-3 flex items-start gap-3" data-testid={`embed-${it.id}`}>
              <div className="shrink-0 h-12 w-12 rounded bg-[#FAF7F2] flex items-center justify-center">
                <Youtube className="h-6 w-6 text-[#2D4A3E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono break-all text-gray-600">{it.file_url}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {it.embed_provider || "embed"} {it.embed_id ? `· id ${it.embed_id}` : ""}
                </p>
                {it.alt_text && <p className="text-xs text-gray-700 mt-1">{it.alt_text}</p>}
              </div>
              <button
                onClick={() => setToRemove(it)}
                className="text-red-600 hover:text-red-700 text-xs"
                aria-label="Remove embed"
                data-testid={`embed-remove-${it.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={open} onOpenChange={(o) => !o && !saving && setOpen(false)}>
        <AlertDialogContent data-testid="travel-add-embed-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Add YouTube or Vimeo URL</AlertDialogTitle>
            <AlertDialogDescription>
              Paste the full URL (e.g. https://www.youtube.com/watch?v=... or https://vimeo.com/123456789). The embed will appear in the About Us gallery alongside your photos and uploaded videos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-600 mb-1">Video URL</span>
              <input
                type="url"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40 font-mono text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                data-testid="travel-embed-url"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-600 mb-1">Caption (optional)</span>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#2D4A3E] focus:outline-none focus:ring-1 focus:ring-[#2D4A3E]/40"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Short description"
                data-testid="travel-embed-alt"
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={saving} data-testid="travel-embed-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
              Add
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this embed?</AlertDialogTitle>
            <AlertDialogDescription>
              The video link will no longer appear in your About Us gallery. The original video on YouTube or Vimeo is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-[#D32F2F] hover:bg-[#b62626]">Yes, remove it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TravelMediaManager() {
  useEffect(() => { document.title = "About Us Travel Gallery | Once Were Wild Admin"; }, []);
  return (
    <AdminShell>
      <div data-testid="travel-media-page">
        <MediaManager
          section={SECTION}
          title="About Us — Travel Photos and Videos"
          subtitle="A swipeable gallery shown on the About Us page. Mix photos (JPG, PNG, WEBP), uploaded videos (MP4) and YouTube / Vimeo embeds freely. Drag to reorder. The first item appears first on the public page."
          ordered
        />
        <EmbedList />
      </div>
    </AdminShell>
  );
}
