import { useEffect } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaManager } from "@/components/admin/MediaManager";

export default function CharityManager() {
  useEffect(() => { document.title = "Charity Photos | Once Were Wild Admin"; }, []);
  return (
    <AdminShell>
      <MediaManager
        section="charity"
        title="Charity Photos"
        subtitle="Add, replace or remove the photos shown on your Charity page."
      />
    </AdminShell>
  );
}
