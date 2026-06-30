import { useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Mail, Phone, MapPin } from "lucide-react";
import { NAV_LINKS, INQUIRY_TYPES } from "@/data/content";
import { useSettings } from "@/context/SettingsContext";
import { useContent, useText } from "@/context/ContentContext";
import api, { formatApiError } from "@/lib/api";
import { CTAButton } from "@/components/ui/CTAButton";

export function Footer() {
  const settings = useSettings();
  const { content } = useContent();
  const exploreLabel = useText("footer.explore_label", "Explore");
  const reachLabel = useText("footer.reach_label", "Reach us");
  const enquiryLabel = useText("footer.enquiry_label", "Quick enquiry");
  const namePh = useText("footer.enquiry_name_placeholder", "Your name");
  const emailPh = useText("footer.enquiry_email_placeholder", "Your email");
  const submitLabel = useText("footer.enquiry_submit", "Send enquiry");
  const copyrightSuffix = useText("footer.copyright_suffix", "Slow journeys, wild hearts");
  // AF - new admin-editable labels.
  const sendingLabel = useText("footer.enquiry_sending", "Sending");
  const rightsText = useText("footer.copyright_rights_text", "All rights reserved.");
  const cookiesLink = useText("footer.cookies_link", "Cookies");
  const links = NAV_LINKS.map((l, i) => ({
    label: content[`nav.${i}.label`] || l.label,
    to: content[`nav.${i}.to`] || l.to,
  }));
  const [form, setForm] = useState({ first_name: "", email: "", inquiry_type: INQUIRY_TYPES[0] });
  const [status, setStatus] = useState("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const { data } = await api.post("/contact", {
        first_name: form.first_name,
        last_name: "(quick enquiry)",
        email: form.email,
        inquiry_type: form.inquiry_type,
        message: `Quick enquiry from the website footer. Interested in: ${form.inquiry_type}.`,
        referral_source: "Footer quick enquiry",
      });
      setMsg(data.message);
      setStatus("done");
      setForm({ first_name: "", email: "", inquiry_type: INQUIRY_TYPES[0] });
    } catch (err) {
      setMsg(formatApiError(err.response?.data?.detail));
      setStatus("error");
    }
  };

  return (
    <footer className="bg-nature-deep text-cream" data-testid="footer">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-20 sm:py-28">
        <div className="grid gap-14 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <img src="/assets/logo-nav-white.png" alt="Once Were Wild Travel" width="200" height="80" className="h-20 w-auto mb-6" />
            <p className="editorial text-cream/70 max-w-xs">
              {settings.footer_tagline || "Slow journeys for women ready to rediscover their wild."}
            </p>
            <div className="mt-7 flex gap-4">
              <a
                href={settings.instagram_url || "#"}
                target="_blank"
                rel="noreferrer"
                aria-label="Follow Once Were Wild Travel on Instagram"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border border-cream/25 hover:border-gold hover:text-gold transition-colors"
                data-testid="footer-instagram"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href={settings.facebook_url || "#"}
                target="_blank"
                rel="noreferrer"
                aria-label="Follow Once Were Wild Travel on Facebook"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border border-cream/25 hover:border-gold hover:text-gold transition-colors"
                data-testid="footer-facebook"
              >
                <Facebook className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Explore + contact */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="label-eyebrow text-gold mb-5">{exploreLabel}</p>
              <ul className="space-y-3">
                {links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-cream/75 hover:text-cream transition-colors" data-testid={`footer-link-${l.label.toLowerCase()}`}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="label-eyebrow text-gold mb-5">{reachLabel}</p>
              <ul className="space-y-3.5 text-cream/75 text-sm">
                <li className="flex items-start gap-2.5"><Mail className="h-4 w-4 mt-0.5 text-gold shrink-0" /><span>{settings.contact_email}</span></li>
                {/* AE1 - footer phone rows. Same fallback chain as the
                    Contact page: phone_1 + phone_2 if filled, else the
                    legacy contact_phone, else nothing. tel: links strip
                    spaces and punctuation so iOS / Android dial them
                    cleanly. */}
                {(() => {
                  const phones = [];
                  if (settings.contact_phone_1_number) phones.push({ label: settings.contact_phone_1_label || "", number: settings.contact_phone_1_number });
                  if (settings.contact_phone_2_number) phones.push({ label: settings.contact_phone_2_label || "", number: settings.contact_phone_2_number });
                  if (phones.length === 0 && settings.contact_phone) phones.push({ label: "", number: settings.contact_phone });
                  return phones.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2.5" data-testid={`footer-phone-row-${idx}`}>
                      <Phone className="h-4 w-4 mt-0.5 text-gold shrink-0" />
                      <span className="flex items-baseline gap-1.5 flex-wrap">
                        {p.label && <span className="text-cream/55">{p.label}</span>}
                        <a
                          href={`tel:${p.number.replace(/[\s()-]/g, "")}`}
                          className="text-cream/75 hover:text-gold transition-colors"
                          data-testid={`footer-phone-link-${idx}`}
                        >
                          {p.number}
                        </a>
                      </span>
                    </li>
                  ));
                })()}
                <li className="flex items-start gap-2.5"><MapPin className="h-4 w-4 mt-0.5 text-gold shrink-0" /><span>{settings.contact_address}</span></li>
              </ul>
            </div>
          </div>

          {/* Quick enquiry */}
          <div>
            <p className="label-eyebrow text-gold mb-5">{enquiryLabel}</p>
            {status === "done" ? (
              <p className="editorial text-cream/80" data-testid="footer-enquiry-success">{msg}</p>
            ) : (
              <form onSubmit={submit} className="space-y-4" data-testid="footer-enquiry-form">
                <label htmlFor="footer-enq-name" className="sr-only">Your name</label>
                <input
                  id="footer-enq-name"
                  required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder={namePh}
                  autoComplete="given-name"
                  className="w-full bg-transparent border-b border-cream/30 py-2.5 placeholder:text-cream/45 focus:border-gold outline-none transition-colors"
                  data-testid="footer-enquiry-name"
                />
                <label htmlFor="footer-enq-email" className="sr-only">Your email address</label>
                <input
                  id="footer-enq-email"
                  required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={emailPh}
                  autoComplete="email"
                  className="w-full bg-transparent border-b border-cream/30 py-2.5 placeholder:text-cream/45 focus:border-gold outline-none transition-colors"
                  data-testid="footer-enquiry-email"
                />
                <label htmlFor="footer-enq-type" className="sr-only">Type of enquiry</label>
                <select
                  id="footer-enq-type"
                  aria-label="Type of enquiry"
                  value={form.inquiry_type} onChange={(e) => setForm({ ...form, inquiry_type: e.target.value })}
                  className="w-full bg-nature-deep border-b border-cream/30 py-2.5 text-cream/80 focus:border-gold outline-none transition-colors"
                  data-testid="footer-enquiry-type"
                >
                  {INQUIRY_TYPES.map((t) => <option key={t} value={t} className="bg-nature-deep">{t}</option>)}
                </select>
                {status === "error" && <p className="text-gold text-sm">{msg}</p>}
                <CTAButton type="submit" variant="gold" className="w-full" disabled={status === "sending"} data-testid="footer-enquiry-submit">
                  {status === "sending" ? sendingLabel : submitLabel}
                </CTAButton>
              </form>
            )}
          </div>
        </div>

        <div className="mt-16 border-t border-cream/15 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-cream/55 text-xs">
          <p>© {new Date().getFullYear()} Once Were Wild Travel. {rightsText}</p>
          <div className="flex items-center gap-4">
            <Link to="/cookies" className="hover:text-cream transition-colors" data-testid="footer-cookies-link">{cookiesLink}</Link>
            <p className="font-accent uppercase tracking-label">{copyrightSuffix}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
