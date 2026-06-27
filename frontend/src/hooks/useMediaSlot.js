import { useState, useEffect } from "react";
import api from "@/lib/api";

// Loads a single admin-managed image for a "slot" (one image per section).
// Returns `{src, lqip, srcset, avifSrcset, item, ready}`. `ready` flips to
// true once the API call has settled, so consumers can avoid painting
// bundled defaults that the admin may have already replaced. The bundled
// `fallback` is only used if the network call fails outright.
export function useMediaSlot(section, fallback = "") {
  const [src, setSrc] = useState("");
  const [lqip, setLqip] = useState("");
  const [srcset, setSrcset] = useState(null);
  const [avifSrcset, setAvifSrcset] = useState(null);
  const [item, setItem] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    api.get("/media", { params: { section } })
      .then(({ data }) => {
        if (!mounted) return;
        const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (first && first.file_url) {
          setSrc(first.file_url);
          setLqip(first.lqip || "");
          setSrcset(first.srcset || null);
          setAvifSrcset(first.avif_srcset || null);
          setItem({ ...first, lqip: first.lqip || "" });
        } else {
          setSrc(""); setLqip(""); setSrcset(null); setAvifSrcset(null); setItem(null);
        }
      })
      .catch(() => { if (mounted) { setSrc(fallback); setLqip(""); setSrcset(null); setAvifSrcset(null); setItem(null); } })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  return { src, lqip, srcset, avifSrcset, item, ready };
}
