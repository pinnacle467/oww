import { useEffect, useState, useMemo } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { Loader2, Search, Download, X, Mail, Phone, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS = {
  new: { label: "New", cls: "bg-[#2D4A3E] text-white" },
  reviewed: { label: "Reviewed", cls: "bg-[#2E6DA4] text-white" },
  responded: { label: "Responded", cls: "bg-gray-200 text-gray-700" },
};

export default function Submissions() {
  useEffect(() => { document.title = "Messages | Once Were Wild Admin"; }, []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [banner, setBanner] = useState("");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/admin/submissions"); setRows(data); }
    catch (e) { setBanner(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const types = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.inquiry_type)))], [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const q = query.toLowerCase();
    const matchesQ = !q || `${r.first_name} ${r.last_name} ${r.email} ${r.message}`.toLowerCase().includes(q);
    const matchesT = typeFilter === "All" || r.inquiry_type === typeFilter;
    return matchesQ && matchesT;
  }), [rows, query, typeFilter]);

  const setStatus = async (row, status) => {
    setRows((arr) => arr.map((r) => (r.id === row.id ? { ...r, status } : r)));
    if (selected?.id === row.id) setSelected({ ...selected, status });
    try { await api.patch(`/admin/submissions/${row.id}`, { status }); }
    catch { load(); }
  };

  const remove = async () => {
    try { await api.delete(`/admin/submissions/${toDelete.id}`); setToDelete(null); setSelected(null); load(); }
    catch (e) { setBanner(formatApiError(e.response?.data?.detail)); }
  };

  const downloadCsv = () => {
    const header = ["Date", "First name", "Last name", "Email", "Phone", "Inquiry type", "Referral", "Status", "Message"];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(",")].concat(
      filtered.map((r) => [new Date(r.created_at).toLocaleString(), r.first_name, r.last_name, r.email, r.phone, r.inquiry_type, r.referral_source, r.status, r.message].map(escape).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `oww-messages-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell>
      <div data-testid="admin-submissions">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h1 className="text-3xl font-semibold text-[#1C1C1C]">Messages</h1>
          <button onClick={downloadCsv} className="flex items-center gap-2 bg-[#2E6DA4] text-white text-base font-medium rounded-md px-5 py-2.5 hover:bg-[#255b8a]" data-testid="download-csv">
            <Download className="h-5 w-5" /> Download as spreadsheet
          </button>
        </div>
        <p className="text-lg text-gray-500 mb-6">Every enquiry sent through your website appears here.</p>

        {banner && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3">{banner}</div>}

        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or words"
              className="w-full text-base rounded-md border border-gray-300 pl-10 pr-3 py-2.5 outline-none focus:border-[#2D4A3E]" data-testid="search-submissions" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-base rounded-md border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2D4A3E]" data-testid="filter-type">
            {types.map((t) => <option key={t} value={t}>{t === "All" ? "All inquiry types" : t}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="h-7 w-7 animate-spin text-[#2D4A3E] mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500 text-lg">No messages to show.</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left" data-testid="submissions-table">
                <thead className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Name</th>
                    <th className="px-5 py-4 hidden md:table-cell">Inquiry</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)} data-testid={`submission-row-${r.id}`}>
                      <td className="px-5 py-4 text-base text-gray-600 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <span className="block text-base font-medium text-[#1C1C1C]">{r.first_name} {r.last_name}</span>
                        <span className="block text-sm text-gray-500">{r.email}</span>
                      </td>
                      <td className="px-5 py-4 text-base text-gray-600 hidden md:table-cell">{r.inquiry_type}</td>
                      <td className="px-5 py-4"><span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span></td>
                      <td className="px-5 py-4 text-right"><span className="text-[#2E6DA4] text-base font-medium">View</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Side drawer */}
      {selected && (
        <div className="fixed inset-0 z-[150] flex justify-end" data-testid="submission-drawer">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-[#1C1C1C]">Message details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700"><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-5 text-base">
              <div>
                <p className="text-sm text-gray-500">Received</p>
                <p className="text-[#1C1C1C]">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">From</p>
                <p className="text-[#1C1C1C] text-lg font-medium">{selected.first_name} {selected.last_name}</p>
              </div>
              <div className="flex flex-col gap-2">
                <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-[#2E6DA4]"><Mail className="h-4 w-4" />{selected.email}</a>
                {selected.phone && <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-[#2E6DA4]"><Phone className="h-4 w-4" />{selected.phone}</a>}
              </div>
              <div><p className="text-sm text-gray-500">Type of inquiry</p><p className="text-[#1C1C1C]">{selected.inquiry_type}</p></div>
              {selected.referral_source && <div><p className="text-sm text-gray-500">Heard about us via</p><p className="text-[#1C1C1C]">{selected.referral_source}</p></div>}
              <div><p className="text-sm text-gray-500">Message</p><p className="text-[#1C1C1C] whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-md p-4 mt-1">{selected.message}</p></div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Mark this message as</p>
                <div className="flex gap-2">
                  {Object.entries(STATUS).map(([key, val]) => (
                    <button key={key} onClick={() => setStatus(selected, key)}
                      className={`rounded-md px-4 py-2 text-sm font-medium border ${selected.status === key ? val.cls + " border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}
                      data-testid={`set-status-${key}`}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setToDelete(selected)} className="flex items-center gap-2 text-[#D32F2F] text-base font-medium mt-4" data-testid="delete-submission">
                <Trash2 className="h-4 w-4" /> Delete this message
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete this message?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">Are you sure you want to delete this message? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-[#D32F2F] hover:bg-[#b62626] text-base" data-testid="confirm-delete-submission">Yes, delete it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
