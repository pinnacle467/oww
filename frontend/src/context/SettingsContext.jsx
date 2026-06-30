import { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const SettingsContext = createContext({});

const FALLBACK = {
  contact_email: "info@oncewerewild.com",
  contact_phone: "+61 457 999 411",
  // AE1 - two separate phone fields. Default labels live here so the
  // public surfaces render the labels even before the client fills in
  // numbers via /admin/settings. Empty numbers cause the matching row
  // to be hidden on every public surface (Contact + Footer).
  contact_phone_1_label: "Adele:",
  contact_phone_1_number: "",
  contact_phone_2_label: "Barbara:",
  contact_phone_2_number: "",
  contact_address: "584 Maleny-Montville Rd, Balmoral Ridge QLD 4552",
  contact_hours: "Monday to Friday, 9am to 5pm AEST",
  footer_tagline: "Slow journeys for women ready to rediscover their wild.",
  instagram_url: "https://instagram.com/oncewerewild",
  facebook_url: "https://facebook.com/oncewerewild",
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);

  useEffect(() => {
    api.get("/settings").then(({ data }) => setSettings({ ...FALLBACK, ...data })).catch(() => {});
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
