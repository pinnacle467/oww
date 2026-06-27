import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import RichTextEditor from "@/components/editor/RichTextEditor";
import {
  Plus, Trash2, Save, Pencil, Eye, EyeOff, Upload, ExternalLink,
  Image as ImageIcon, X, FileText,
} from "lucide-react";

// /admin/blog — list of posts in a table, plus a full-screen editor opened
// when the operator clicks "New post" or "Edit". Two modes per editor:
//   - "create"  -> POST /admin/blog
//   - "edit"    -> PATCH /admin/blog/{id} (+ featured image upload)
// Status toggle Draft/Published is on every row AND inside the editor.

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const blankDraft = () => ({
  title: "",
  excerpt: "",
  body: "",
  status: "draft",
  published_date: todayIso(),
});

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function BlogManager() {
  useEffect(() => { document.title = "Blog | Once Were Wild Admin"; }, []);

  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [editorPost, setEditorPost] = useState(null);   // { mode: 'create'|'edit', post: {} }

  const load = async () => {
    try {
      const { data } = await api.get("/admin/blog");
      setPosts(data || []);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Could not load posts");
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => setEditorPost({ mode: "create", post: blankDraft() });
  const openEdit = (post) => setEditorPost({ mode: "edit", post: { ...post } });
  const closeEditor = () => setEditorPost(null);

  const togglePublish = async (p) => {
    const next = p.status === "published" ? "draft" : "published";
    try {
      await api.patch(`/admin/blog/${p.id}`, { status: next });
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Could not change status");
    }
  };

  const deletePost = async (p) => {
    if (!window.confirm(`Delete the post "${p.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/blog/${p.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Delete failed");
    }
  };

  return (
    <AdminShell>
      <div className="max-w-6xl" data-testid="blog-manager">
        <p className="text-base text-gray-500">Blog</p>
        <h1 className="text-3xl font-semibold text-[#1C1C1C]">Blog posts</h1>
        <p className="text-base text-gray-500 mt-2 mb-8 max-w-2xl">
          Standalone posts shown on <span className="font-medium">/blog</span>. Separate from
          &quot;Stories from the Road&quot; on the About page. Newest published_date appears first.
        </p>

        <div className="flex items-center justify-between mb-5 gap-4">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded-lg hover:bg-[#1F3329] transition-colors text-sm"
            data-testid="new-post-btn"
          >
            <Plus className="h-4 w-4" /> New post
          </button>
          <Link
            to="/blog"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#2D4A3E]"
            data-testid="view-blog-link"
          >
            View public blog <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center" data-testid="blog-empty">
            <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 text-base font-medium">No posts yet</p>
            <p className="text-gray-500 text-sm mt-1">Click &quot;New post&quot; to write your first blog entry.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 w-32">Date</th>
                  <th className="px-4 py-3 w-28">Status</th>
                  <th className="px-4 py-3 w-44 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((p) => (
                  <tr key={p.id} data-testid={`blog-row-${p.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1C1C1C]">{p.title}</div>
                      {p.excerpt && (
                        <div className="text-gray-500 text-xs mt-0.5 line-clamp-1 max-w-md">{p.excerpt}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(p.published_date)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublish(p)}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                          p.status === "published"
                            ? "bg-[#2D4A3E]/10 text-[#2D4A3E]"
                            : "bg-amber-100 text-amber-800"
                        }`}
                        data-testid={`status-toggle-${p.id}`}
                        title="Click to toggle status"
                      >
                        {p.status === "published" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {p.status === "published" ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                          data-testid={`edit-post-${p.id}`}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => deletePost(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50"
                          data-testid={`delete-post-${p.id}`}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editorPost && (
        <PostEditorDrawer
          mode={editorPost.mode}
          initial={editorPost.post}
          onClose={closeEditor}
          onSaved={async () => { await load(); closeEditor(); }}
        />
      )}
    </AdminShell>
  );
}

function PostEditorDrawer({ mode, initial, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => ({
    id: initial.id || null,
    title: initial.title || "",
    excerpt: initial.excerpt || "",
    body: initial.body || "",
    status: initial.status || "draft",
    published_date: initial.published_date || todayIso(),
    featured_url: initial.featured_url || "",
    featured_srcset: initial.featured_srcset || {},
    featured_avif_srcset: initial.featured_avif_srcset || {},
    featured_lqip: initial.featured_lqip || "",
    slug: initial.slug || "",
  }));
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileRef = useRef(null);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (statusOverride) => {
    if (!draft.title.trim()) {
      alert("Please give the post a title.");
      return;
    }
    const status = statusOverride || draft.status;
    setSaving(true);
    try {
      if (mode === "create") {
        const { data } = await api.post("/admin/blog", {
          title: draft.title,
          excerpt: draft.excerpt,
          body: draft.body,
          status,
          published_date: draft.published_date,
        });
        // If a cover image was selected before the post existed, upload it now.
        if (fileRef.current?.files?.[0] && data?.id) {
          await uploadCoverFor(data.id, fileRef.current.files[0]);
        }
      } else {
        await api.patch(`/admin/blog/${draft.id}`, {
          title: draft.title,
          excerpt: draft.excerpt,
          body: draft.body,
          status,
          published_date: draft.published_date,
        });
      }
      await onSaved();
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadCoverFor = async (postId, file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Image is too large. Max 15 MB.");
      return;
    }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/admin/blog/${postId}/cover`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set({
        featured_url: data.featured_url,
        featured_srcset: data.featured_srcset,
        featured_avif_srcset: data.featured_avif_srcset,
        featured_lqip: data.featured_lqip,
      });
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Cover upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const onPickCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mode === "edit" && draft.id) {
      await uploadCoverFor(draft.id, file);
    } else {
      // Preview only; will be uploaded after the post is created.
      const url = URL.createObjectURL(file);
      set({ featured_url: url, featured_srcset: {}, featured_avif_srcset: {}, featured_lqip: "" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end" data-testid="blog-editor-drawer">
      <div className="bg-[#F4F2EE] w-full max-w-3xl h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1C1C1C]">
            {mode === "create" ? "New blog post" : "Edit blog post"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded" aria-label="Close" data-testid="close-blog-editor">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#1C1C1C] mb-1">Post title *</label>
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="A descriptive headline for the post"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-base"
              data-testid="blog-title-input"
            />
            {draft.slug && (
              <p className="text-xs text-gray-500 mt-1">
                URL: <span className="font-mono">/blog/{draft.slug}</span>
              </p>
            )}
          </div>

          {/* Date + Status */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1C1C1C] mb-1">Published date</label>
              <input
                type="date"
                value={draft.published_date}
                onChange={(e) => set({ published_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                data-testid="blog-date-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1C1C1C] mb-1">Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set({ status: "draft" })}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                    draft.status === "draft"
                      ? "bg-amber-100 border-amber-300 text-amber-900"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                  data-testid="status-draft-btn"
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => set({ status: "published" })}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                    draft.status === "published"
                      ? "bg-[#2D4A3E] border-[#2D4A3E] text-white"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                  data-testid="status-published-btn"
                >
                  Published
                </button>
              </div>
            </div>
          </div>

          {/* Featured image */}
          <div>
            <label className="block text-sm font-medium text-[#1C1C1C] mb-1">Featured image (optional)</label>
            <div className="flex items-start gap-4">
              <div className="w-48 aspect-[16/10] bg-white border border-gray-200 rounded-md overflow-hidden flex items-center justify-center shrink-0">
                {draft.featured_url ? (
                  <img src={draft.featured_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickCover}
                  data-testid="blog-cover-input"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingCover}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-white disabled:opacity-60"
                  data-testid="blog-cover-upload-btn"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingCover ? "Uploading..." : draft.featured_url ? "Replace image" : "Upload image"}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  PNG, JPG, WebP up to 15 MB. Shown on the index card and at the top of the post.
                  {mode === "create" && " The image uploads after the post is saved for the first time."}
                </p>
              </div>
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-[#1C1C1C] mb-1">Excerpt / teaser</label>
            <textarea
              value={draft.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
              rows={3}
              placeholder="A short summary (1-2 sentences) shown on the blog index card."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              data-testid="blog-excerpt-input"
            />
          </div>

          {/* Body — rich text */}
          <div>
            <label className="block text-sm font-medium text-[#1C1C1C] mb-1">Post body</label>
            <RichTextEditor
              value={draft.body}
              onChange={(html) => set({ body: html })}
              placeholder="Write your post here. Use the toolbar for headings, bold, bullets, links and images."
            />
            <p className="text-xs text-gray-500 mt-2">
              Tip: Use H2 for major sections and H3 for sub-sections so the post stays scannable.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            data-testid="cancel-blog-edit"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => save("draft")}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-md text-sm hover:bg-gray-50 disabled:opacity-60"
              data-testid="save-draft-btn"
            >
              <Save className="h-4 w-4" /> Save as draft
            </button>
            <button
              onClick={() => save("published")}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D4A3E] text-white rounded-md text-sm hover:bg-[#1F3329] disabled:opacity-60"
              data-testid="save-publish-btn"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save and publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
