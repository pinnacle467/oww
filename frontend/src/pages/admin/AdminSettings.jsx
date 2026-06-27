import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { Loader2, Save, Check } from "lucide-react";

const FIELDS = [
  { key: "contact_email", label: "Email address" },
  { key: "contact_phone", label: "Phone number" },
  { key: "contact_address", label: "Office or mailing address" },
  { key: "contact_hours", label: "Office hours" },
  { key: "footer_tagline", label: "Footer tagline" },
  { key: "instagram_url", label: "Instagram link" },
  { key: "facebook_url", label: "Facebook link" },
];

export default function AdminSettings() {
  useEffect(() => { document.title = "Settings | Once Were Wild Admin"; }, []);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState("");

  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.get("/settings").then(({ data }) => setValues(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveDetails = async () => {
    setSavingDetails(true); setDetailsMsg("");
    try {
      const payload = {}; FIELDS.forEach((f) => (payload[f.key] = values[f.key] || ""));
      await api.put("/admin/settings", { settings: payload });
      setDetailsMsg("Your changes have been saved.");
      setTimeout(() => setDetailsMsg(""), 2500);
    } catch (e) { setDetailsMsg(formatApiError(e.response?.data?.detail)); }
    finally { setSavingDetails(false); }
  };

  const changePassword = async () => {
    setPwMsg({ type: "", text: "" });
    if (pw.new_password !== pw.confirm) { setPwMsg({ type: "error", text: "The new passwords do not match." }); return; }
    if (pw.new_password.length < 8) { setPwMsg({ type: "error", text: "Your new password must be at least 8 characters." }); return; }
    setSavingPw(true);
    try {
      const { data } = await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      setPwMsg({ type: "success", text: data.message });
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (e) { setPwMsg({ type: "error", text: formatApiError(e.response?.data?.detail) }); }
    finally { setSavingPw(false); }
  };

  const inputCls = "w-full text-lg rounded-md border border-gray-300 px-4 py-3 outline-none focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20";

  return (
    <AdminShell>
      <div data-testid="admin-settings" className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-[#1C1C1C] mb-2">Settings</h1>
        <p className="text-lg text-gray-500 mb-8">Update your website details and your password here.</p>

        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-[#2D4A3E]" />
        ) : (
          <div className="space-y-8">
            <section className="bg-white rounded-lg border border-gray-200 p-7" data-testid="settings-details">
              <h2 className="text-2xl font-semibold text-[#1C1C1C] mb-1">Contact and footer details</h2>
              <p className="text-base text-gray-500 mb-6">These appear on your Contact page and in the website footer.</p>
              <div className="space-y-5">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-base font-medium text-gray-700 mb-1.5">{f.label}</label>
                    <input className={inputCls} value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} data-testid={`setting-${f.key}`} />
                  </div>
                ))}
              </div>
              {detailsMsg && <p className="mt-4 text-green-700 text-base bg-green-50 rounded-md px-4 py-3 flex items-center gap-2"><Check className="h-5 w-5" />{detailsMsg}</p>}
              <button onClick={saveDetails} disabled={savingDetails}
                className="mt-6 flex items-center gap-2 bg-[#4A7C6F] text-white text-lg font-medium rounded-md px-7 py-3 hover:bg-[#3a6357] disabled:opacity-60" data-testid="save-settings">
                {savingDetails ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Save changes
              </button>
            </section>

            <section className="bg-white rounded-lg border border-gray-200 p-7" data-testid="settings-password">
              <h2 className="text-2xl font-semibold text-[#1C1C1C] mb-1">Change your password</h2>
              <p className="text-base text-gray-500 mb-6">Choose something only you would know, at least 8 characters.</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1.5">Current password</label>
                  <input type="password" className={inputCls} value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} data-testid="current-password" />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1.5">New password</label>
                  <input type="password" className={inputCls} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} data-testid="new-password" />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1.5">Confirm new password</label>
                  <input type="password" className={inputCls} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} data-testid="confirm-password" />
                </div>
              </div>
              {pwMsg.text && <p className={`mt-4 text-base rounded-md px-4 py-3 ${pwMsg.type === "error" ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50"}`} data-testid="password-message">{pwMsg.text}</p>}
              <button onClick={changePassword} disabled={savingPw}
                className="mt-6 flex items-center gap-2 bg-[#2E6DA4] text-white text-lg font-medium rounded-md px-7 py-3 hover:bg-[#255b8a] disabled:opacity-60" data-testid="change-password-btn">
                {savingPw ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Update password
              </button>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
