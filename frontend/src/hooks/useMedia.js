import { useState, useEffect } from "react";
import api from "@/lib/api";

// Loads admin-managed media for a section. Returns `{items, ready}` so
// consumers can avoid painting bundled defaults that the admin may have
// already replaced. `ready` flips true once the API call settles (success
// OR error). If you genuinely need offline-first defaults, pass `fallback`
// and they will be used ONLY when the API call fails.
export function useMedia(section, fallback = []) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    api.get("/media", { params: { section } })
      .then(({ data }) => {
        if (!mounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setItems(data.map((m) => ({
            id: m.id,
            src: m.file_url,
            srcset: m.srcset || null,
            avif_srcset: m.avif_srcset || null,
            thumb: m.thumb_url || "",
            lqip: m.lqip || "",
            caption: m.caption,
            category: m.category,
            alt: m.alt_text || "",
            file_type: m.file_type,
          })));
        } else {
          setItems([]);
        }
      })
      .catch(() => { if (mounted) setItems(fallback); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, ready };
}
