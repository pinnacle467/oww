import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

const DEFAULT_CATEGORIES = ["Maleny Retreats", "Across Australia", "Across the World"];

// array of admin-managed categories. Refetches when `refresh()` is called.
export function useGalleryCategories() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setReady(false);
    return api.get("/gallery-categories")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) setCategories(data);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { categories, ready, refresh };
}
