import { useEffect, useState } from "react";
import { Mail, Phone, MapPin, Clock, Check, Navigation } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { PageHero } from "@/components/layout/PageHero";
import { CTAButton } from "@/components/ui/CTAButton";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CountryCodeSelect } from "@/components/ui/CountryCodeSelect";
import { DEFAULT_COUNTRY } from "@/data/countries";
import { INQUIRY_TYPES, REFERRAL_SOURCES } from "@/data/content";
import { useText, useRichText } from "@/context/ContentContext";
import { useMediaSlot } from "@/hooks/useMediaSlot";
import { FadeImg } from "@/components/ui/FadeImg";
import { Seo } from "@/components/seo/Seo";

const EMPTY = { first_name: "", last_name: "", email: "", phone: "", inquiry_type: "", message: "", referral_source: "" };

export default function Contact() {
  const settings = useSettings();
  const heroEyebrow = useText("contact.hero.eyebrow", "Say Hello");
  const heroTitle = useRichText("contact.hero.title", "Let us begin *a conversation.*");
  const heroIntro = useText("contact.hero.intro", "Tell us where your heart is pointing. We read every message ourselves, and we would love to hear from you.");
  const infoEyebrow = useText("contact.info.eyebrow", "Reach us directly");
  const submitIdle = useText("contact.form.submit_idle", "Send message");
  const submitSending = useText("contact.form.submit_sending", "Sending your message");
  const successHeading = useText("contact.success.heading", "Thank you.");
  const sendAnother = useText("contact.success.send_another", "Send another message");
  const directionsLabel = useText("contact.directions.label", "Get Directions");
  // Sidebar (contact-info column) labels
  const infoEmailLabel = useText("contact.info.email_label", "Email");
  const infoPhoneLabel = useText("contact.info.phone_label", "Phone");
  const infoAddressLabel = useText("contact.info.address_label", "Find us");
  const infoHoursLabel = useText("contact.info.hours_label", "Hours");
  // Form field labels (without the required asterisk — that is rendered separately)
  const fieldFirstName = useText("contact.form.first_name_label", "First name");
  const fieldLastName = useText("contact.form.last_name_label", "Last name");
  const fieldEmail = useText("contact.form.email_label", "Email");
  const fieldPhone = useText("contact.form.phone_label", "Phone (optional)");
  const fieldPhonePlaceholder = useText("contact.form.phone_placeholder", "Mobile number");
  const fieldInquiry = useText("contact.form.inquiry_label", "Type of inquiry");
  const fieldInquiryPlaceholder = useText("contact.form.inquiry_placeholder", "Please choose");
  const fieldMessage = useText("contact.form.message_label", "Your message");
  const fieldMessagePlaceholder = useText("contact.form.message_placeholder", "Tell us a little about what you are dreaming of...");
  const fieldReferral = useText("contact.form.referral_label", "How did you hear about us? (optional)");
  const fieldReferralPlaceholder = useText("contact.form.referral_placeholder", "Please choose");
  // Validation error messages
  const errFirstName = useText("contact.errors.first_name", "Please tell us your first name.");
  const errLastName = useText("contact.errors.last_name", "Please tell us your last name.");
  const errEmail = useText("contact.errors.email", "Please enter a valid email address.");
  const errInquiry = useText("contact.errors.inquiry", "Please choose the kind of journey you have in mind.");
  const errMessage = useText("contact.errors.message", "A few more words please, at least 20 characters.");
  const { src: heroImg, lqip: heroLqip, srcset: heroSrcset } = useMediaSlot("contact-hero", "/assets/images/hero/hero-04.webp");
  const { src: contactBg } = useMediaSlot("contact-bg", "/assets/images/pillar-retreat.webp");
  const [form, setForm] = useState(EMPTY);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [serverMsg, setServerMsg] = useState("");

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = errFirstName;
    if (!form.last_name.trim()) e.last_name = errLastName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = errEmail;
    if (!form.inquiry_type) e.inquiry_type = errInquiry;
    if (form.message.trim().length < 20) e.message = errMessage;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    try {
      const payload = {
        ...form,
        phone: form.phone.trim() ? `${country.d} ${form.phone.trim()}` : "",
      };
      const { data } = await api.post("/contact", payload);
      setServerMsg(data.message);
      setStatus("done");
      setForm(EMPTY);
      setCountry(DEFAULT_COUNTRY);
    } catch (err) {
      setServerMsg(formatApiError(err.response?.data?.detail));
      setStatus("error");
    }
  };

  const field = "w-full bg-white/10 border-b border-white/45 px-3 py-3 rounded-t-sm font-body text-white placeholder:text-white/60 focus:border-gold focus:bg-white/[0.14] outline-none transition-colors";
  const selectCls = "w-full bg-white/10 border-b border-white/45 px-3 py-3 rounded-t-sm font-body text-white focus:border-gold outline-none transition-colors [&>option]:text-ink [&>option]:bg-white";

  const MAP_ADDRESS = "584 Maleny-Montville Rd, Balmoral Ridge QLD 4552";
  const directionsHref = () => {
    const enc = encodeURIComponent(MAP_ADDRESS);
    const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS ? `http://maps.apple.com/?daddr=${enc}` : `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
  };
  const mailHref = `mailto:${settings.contact_email}?subject=${encodeURIComponent("I'm ready to rediscover my wild!")}&body=${encodeURIComponent("Hello Once Were Wild,\n\nI have been dreaming of an adventure and would love to hear more about your journeys and retreats.\n\n")}`;

  return (
    <div data-testid="contact-page">
      <Seo
        page="contact"
        path="/contact"
        type="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "url": "https://oncewerewild.com/contact",
          "about": { "@id": "https://oncewerewild.com/#organization" },
          "mainEntity": { "@id": "https://oncewerewild.com/#localbusiness" },
        }}
      />
      <PageHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        intro={heroIntro}
        image={heroImg}
        srcset={heroSrcset}
        lqip={heroLqip}
        height="h-[52vh]"
      />

      <section className="relative py-20 sm:py-28 overflow-hidden" data-testid="contact-section">
        <div className="absolute inset-0">
          {/* ADMIN: ambient backdrop for the contact form */}
          <FadeImg src={contactBg} alt="" loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(125deg, rgba(26,42,36,0.94), rgba(26,58,92,0.86))" }} />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid gap-14 lg:grid-cols-12 lg:gap-20">
          {/* Info */}
          <div className="lg:col-span-4">
            <ScrollReveal>
              <p className="label-eyebrow text-gold mb-6">{infoEyebrow}</p>
              <ul className="space-y-7">
                <li className="flex items-start gap-4" data-testid="contact-email">
                  <span className="glass rounded-full p-3 text-gold"><Mail className="h-5 w-5" /></span>
                  <div>
                    <p className="font-accent text-[11px] uppercase tracking-label text-cream/90 mb-1">{infoEmailLabel}</p>
                    <a href={mailHref} className="text-cream hover:text-gold transition-colors" data-testid="contact-email-link">{settings.contact_email}</a>
                  </div>
                </li>
                <li className="flex items-start gap-4" data-testid="contact-phone">
                  <span className="glass rounded-full p-3 text-gold"><Phone className="h-5 w-5" /></span>
                  <div>
                    <p className="font-accent text-[11px] uppercase tracking-label text-cream/90 mb-1">{infoPhoneLabel}</p>
                    <a href={`tel:${settings.contact_phone}`} className="text-cream hover:text-gold transition-colors">{settings.contact_phone}</a>
                  </div>
                </li>
                <li className="flex items-start gap-4" data-testid="contact-address">
                  <span className="glass rounded-full p-3 text-gold"><MapPin className="h-5 w-5" /></span>
                  <div>
                    <p className="font-accent text-[11px] uppercase tracking-label text-cream/90 mb-1">{infoAddressLabel}</p>
                    <p className="text-cream">{settings.contact_address}</p>
                  </div>
                </li>
                <li className="flex items-start gap-4" data-testid="contact-hours">
                  <span className="glass rounded-full p-3 text-gold"><Clock className="h-5 w-5" /></span>
                  <div>
                    <p className="font-accent text-[11px] uppercase tracking-label text-cream/90 mb-1">{infoHoursLabel}</p>
                    <p className="text-cream">{settings.contact_hours}</p>
                  </div>
                </li>
              </ul>

              {/* Map placeholder, ready for client embed */}
              {/* Live Google Maps embed (keyless) for the real Maleny location */}
              <div className="mt-10 overflow-hidden rounded-sm border border-white/15 shadow-2xl" data-testid="contact-map">
                <iframe
                  title="Once Were Wild location, 584 Maleny-Montville Rd, Balmoral Ridge QLD 4552"
                  src="https://maps.google.com/maps?q=584%20Maleny-Montville%20Rd%2C%20Balmoral%20Ridge%20QLD%204552&z=14&output=embed"
                  className="w-full aspect-[4/3] block"
                  style={{ border: 0, filter: "saturate(0.95) contrast(1.02)" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <a
                href={directionsHref()}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center justify-center gap-2 w-full rounded-full border border-gold/80 bg-nature-deep/40 backdrop-blur-md px-6 py-3 font-accent text-xs uppercase tracking-label text-gold hover:bg-gold hover:text-ink transition-all duration-300"
                data-testid="get-directions-btn"
              >
                <Navigation className="h-4 w-4" /> {directionsLabel}
              </a>
            </ScrollReveal>
          </div>

          {/* Form */}
          <div className="lg:col-span-7 lg:col-start-6">
            <ScrollReveal>
              <div className="rounded-sm p-7 sm:p-10 border border-white/15 shadow-2xl" style={{ background: "rgba(19,30,25,0.66)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}>
                {status === "done" ? (
                  <div className="text-center py-12" data-testid="contact-success">
                    <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full glass text-gold">
                      <Check className="h-8 w-8" />
                    </span>
                    <h3 className="font-display font-light text-cream text-3xl mb-3">{successHeading}</h3>
                    <p className="editorial text-cream/75 max-w-md mx-auto">{serverMsg}</p>
                    <button onClick={() => setStatus("idle")} className="mt-7 font-accent text-xs uppercase tracking-label text-gold hover:text-white" data-testid="contact-send-another">
                      {sendAnother}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} noValidate className="space-y-6" data-testid="contact-form">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="contact-fn" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldFirstName} *</label>
                        <input id="contact-fn" autoComplete="given-name" className={field} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} data-testid="contact-first-name" />
                        {errors.first_name && <p className="text-destructive text-sm mt-1.5" data-testid="error-first-name">{errors.first_name}</p>}
                      </div>
                      <div>
                        <label htmlFor="contact-ln" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldLastName} *</label>
                        <input id="contact-ln" autoComplete="family-name" className={field} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} data-testid="contact-last-name" />
                        {errors.last_name && <p className="text-destructive text-sm mt-1.5" data-testid="error-last-name">{errors.last_name}</p>}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="contact-em" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldEmail} *</label>
                        <input id="contact-em" type="email" autoComplete="email" className={field} value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="contact-email-input" />
                        {errors.email && <p className="text-destructive text-sm mt-1.5" data-testid="error-email">{errors.email}</p>}
                      </div>
                      <div>
                        <label htmlFor="contact-ph" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldPhone}</label>
                        <div className="flex items-end gap-2">
                          <CountryCodeSelect value={country} onChange={setCountry} />
                          <input
                            id="contact-ph"
                            type="tel"
                            autoComplete="tel"
                            className={field}
                            value={form.phone}
                            onChange={(e) => set("phone", e.target.value)}
                            placeholder={fieldPhonePlaceholder}
                            data-testid="contact-phone-input"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="contact-iq" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldInquiry} *</label>
                      <select id="contact-iq" aria-label="Type of inquiry" className={selectCls} value={form.inquiry_type} onChange={(e) => set("inquiry_type", e.target.value)} data-testid="contact-inquiry-type">
                        <option value="">{fieldInquiryPlaceholder}</option>
                        {INQUIRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {errors.inquiry_type && <p className="text-destructive text-sm mt-1.5" data-testid="error-inquiry-type">{errors.inquiry_type}</p>}
                    </div>
                    <div>
                      <label htmlFor="contact-msg" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldMessage} *</label>
                      <textarea id="contact-msg" rows={5} className={`${field} resize-none`} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder={fieldMessagePlaceholder} data-testid="contact-message" />
                      {errors.message && <p className="text-destructive text-sm mt-1.5" data-testid="error-message">{errors.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="contact-ref" className="font-accent text-[11px] uppercase tracking-label text-cream/90">{fieldReferral}</label>
                      <select id="contact-ref" aria-label="How did you hear about us" className={selectCls} value={form.referral_source} onChange={(e) => set("referral_source", e.target.value)} data-testid="contact-referral">
                        <option value="">{fieldReferralPlaceholder}</option>
                        {REFERRAL_SOURCES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {status === "error" && <p className="text-destructive text-sm" data-testid="contact-error">{serverMsg}</p>}
                    <CTAButton type="submit" variant="light" className="w-full" disabled={status === "sending"} data-testid="contact-submit">
                      {status === "sending" ? submitSending : submitIdle}
                    </CTAButton>
                  </form>
                )}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
}
