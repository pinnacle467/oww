import { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const ContentContext = createContext({ content: {}, ready: false, refresh: () => {}, applyOptimistic: () => {} });

export function ContentProvider({ children }) {
  const [content, setContent] = useState({});
  const [ready, setReady] = useState(false);

  const refresh = () =>
    api
      .get("/content")
      .then(({ data }) => setContent(data || {}))
      .catch(() => {})
      .finally(() => setReady(true));

  useEffect(() => { refresh(); }, []);

  // Merge a `{ key: value }` patch into the live content store BEFORE the
  // server has confirmed. The public site (and any admin previews) update
  // instantly; if the network call later fails the caller can pass the
  // previous snapshot back in to roll back.
  const applyOptimistic = (patch) => {
    setContent((prev) => ({ ...prev, ...patch }));
  };

  return (
    <ContentContext.Provider value={{ content, ready, refresh, applyOptimistic }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}

// Read a single content key with a literal fallback so the site renders identically
// even before the API returns. The fallback is also the seed value, so behaviour
// stays unchanged for the public site if /api/content is empty.
export function useText(key, fallback = "") {
  const { content } = useContent();
  const v = content[key];
  return v == null || v === "" ? fallback : v;
}

// Tiny inline markdown: *italic* and _italic_ become an italic span.
// Allows admins to keep the elegant italic phrasing without breaking layout.
function renderInline(s) {
  if (!s || typeof s !== "string") return s;
  const parts = s.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (/^\*[^*]+\*$/.test(p)) return <em key={i} className="italic">{p.slice(1, -1)}</em>;
    if (/^_[^_]+_$/.test(p)) return <em key={i} className="italic">{p.slice(1, -1)}</em>;
    return p;
  });
}

// Tiny declarative variant: <T k="home.manifesto.heading">Default copy</T>.
export function T({ k, children }) {
  const v = useText(k, typeof children === "string" ? children : "");
  return v;
}

// Render a content value with inline markup (*italic*) honoured.
export function useRichText(key, fallback = "") {
  const v = useText(key, fallback);
  return renderInline(v);
}

// Convenience: pull an editable list value stored as a separated string.
// e.g. "create,explore,feel" -> ["create","explore","feel"]
export function useTextList(key, fallback = [], sep = ",") {
  const v = useText(key, "");
  if (!v) return fallback;
  return v.split(sep).map((s) => s.trim()).filter(Boolean);
}
