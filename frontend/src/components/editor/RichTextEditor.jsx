import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import api, { formatApiError } from "@/lib/api";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, Undo2, Redo2, Quote,
} from "lucide-react";

// A small, focused TipTap-based WYSIWYG used by the blog editor.
// Supports: bold, italic, H2, H3, bullet list, ordered list, blockquote,
// inline link, inline image (uploaded to /api/admin/blog/image), undo/redo.
// Emits `onChange(html)` whenever the document changes.
export default function RichTextEditor({ value, onChange, placeholder, testIdPrefix = "blog-body" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ HTMLAttributes: { class: "rounded-md max-w-full h-auto my-3" } }),
      Placeholder.configure({
        placeholder: placeholder || "Write your post...",
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-gray-400 before:float-left before:h-0 before:pointer-events-none",
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose max-w-none focus:outline-none min-h-[260px] px-4 py-3 text-[#1C1C1C]",
        "data-testid": `${testIdPrefix}-editor`,
      },
    },
  });

  // Reset content when value changes from the outside (e.g. switching posts).
  useEffect(() => {
    if (!editor) return;
    if (value === undefined || value === null) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const addLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL (leave empty to remove):", previous);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const onPickImage = async (file) => {
    if (!file || !editor) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Image is too large. Max 15 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/blog/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data?.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (e) {
      alert(formatApiError(e?.response?.data?.detail) || "Image upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-md min-h-[300px] bg-gray-50" aria-busy="true" />
    );
  }

  const btn =
    "inline-flex items-center justify-center h-8 w-8 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30";
  const btnActive = "bg-[#2D4A3E] text-white hover:bg-[#1F3329]";

  return (
    <div className="border border-gray-300 rounded-md bg-white" data-testid={`${testIdPrefix}-wrapper`}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50/60 rounded-t-md">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${btn} ${editor.isActive("bold") ? btnActive : ""}`} title="Bold" data-testid={`${testIdPrefix}-bold`}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${btn} ${editor.isActive("italic") ? btnActive : ""}`} title="Italic" data-testid={`${testIdPrefix}-italic`}>
          <Italic className="h-4 w-4" />
        </button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${btn} ${editor.isActive("heading", { level: 2 }) ? btnActive : ""}`} title="Heading 2" data-testid={`${testIdPrefix}-h2`}>
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${btn} ${editor.isActive("heading", { level: 3 }) ? btnActive : ""}`} title="Heading 3" data-testid={`${testIdPrefix}-h3`}>
          <Heading3 className="h-4 w-4" />
        </button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${btn} ${editor.isActive("bulletList") ? btnActive : ""}`} title="Bullet list" data-testid={`${testIdPrefix}-bullet`}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${btn} ${editor.isActive("orderedList") ? btnActive : ""}`} title="Numbered list" data-testid={`${testIdPrefix}-ordered`}>
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${btn} ${editor.isActive("blockquote") ? btnActive : ""}`} title="Quote" data-testid={`${testIdPrefix}-quote`}>
          <Quote className="h-4 w-4" />
        </button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={addLink}
          className={`${btn} ${editor.isActive("link") ? btnActive : ""}`} title="Link" data-testid={`${testIdPrefix}-link`}>
          <LinkIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}
          disabled={uploading} className={btn} title="Insert image" data-testid={`${testIdPrefix}-image`}>
          <ImageIcon className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickImage(e.target.files?.[0])}
          data-testid={`${testIdPrefix}-image-input`}
        />
        {uploading && <span className="text-xs text-gray-500 ml-2">Uploading image...</span>}
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()}
          className={btn} title="Undo" data-testid={`${testIdPrefix}-undo`}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()}
          className={btn} title="Redo" data-testid={`${testIdPrefix}-redo`}>
          <Redo2 className="h-4 w-4" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
