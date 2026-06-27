import { useEffect, useState } from "react";
import { Seo } from "@/components/seo/Seo";
import { COOKIE_KEY } from "@/components/CookieBanner";

// Static cookies policy. Plain, plain-English copy, no em dashes.
export default function CookiesPolicy() {
  const [decision, setDecision] = useState("");

  useEffect(() => {
    try { setDecision(window.localStorage.getItem(COOKIE_KEY) || ""); } catch (e) { /* ignore */ }
  }, []);

  const reset = () => {
    try { window.localStorage.removeItem(COOKIE_KEY); } catch (e) { /* ignore */ }
    setDecision("");
    // Force banner to reappear on next route view.
    try { window.dispatchEvent(new CustomEvent("oww:cookie-decision", { detail: "reset" })); } catch (e) { /* ignore */ }
    window.location.reload();
  };

  return (
    <div data-testid="cookies-page" className="bg-cream">
      <Seo page="cookies" path="/cookies" />
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-24 sm:py-32">
        <p className="label-eyebrow text-nature-mid mb-3">Legal</p>
        <h1 className="font-display font-light text-ink text-4xl sm:text-5xl leading-tight mb-8">Cookies policy</h1>
        <p className="editorial text-ink-soft text-base sm:text-lg leading-relaxed mb-6">
          This site uses a small number of cookies to keep things working and to help us understand how you find your way around. Nothing here is sold to a third party.
        </p>

        <h2 className="font-display text-2xl text-ink mt-12 mb-3">What is a cookie</h2>
        <p className="editorial text-ink-soft leading-relaxed mb-4">
          A cookie is a tiny text file stored on your device by your browser. It lets a website remember something simple about your visit, like whether you have already seen the welcome banner.
        </p>

        <h2 className="font-display text-2xl text-ink mt-12 mb-3">What we use</h2>
        <ul className="editorial text-ink-soft leading-relaxed space-y-3 list-disc pl-5">
          <li>
            <strong>Strictly necessary.</strong> These keep the site running. They remember things like your cookie choice on this page and your admin login if you happen to be the site owner.
          </li>
          <li>
            <strong>Anonymous analytics.</strong> If you accept, we use a privacy-friendly analytics tool to count visits and see which pages people enjoy. We never see your name, your email or your exact location.
          </li>
        </ul>

        <h2 className="font-display text-2xl text-ink mt-12 mb-3">Your choice</h2>
        <p className="editorial text-ink-soft leading-relaxed mb-4">
          You can accept or decline analytics cookies using the banner that appears the first time you visit. Strictly necessary cookies do not need consent because the site cannot function without them. You can change your mind at any time using the button below.
        </p>

        <div className="mt-6 mb-12 rounded-md bg-white border border-nature-deep/10 p-5">
          <p className="text-sm text-ink-soft mb-3">
            Current preference: {" "}
            <span className="font-medium text-ink" data-testid="cookie-current-choice">
              {decision === "accepted" ? "Accepted" : decision === "declined" ? "Declined" : "Not set"}
            </span>
          </p>
          <button
            onClick={reset}
            className="font-accent text-[11px] uppercase tracking-label px-5 py-2.5 rounded-sm bg-nature-deep text-cream hover:bg-nature-mid transition-colors"
            data-testid="cookie-reset"
          >
            Change my choice
          </button>
        </div>

        <h2 className="font-display text-2xl text-ink mt-12 mb-3">Contact</h2>
        <p className="editorial text-ink-soft leading-relaxed">
          If you have a question about how we handle data, get in touch via the form on our contact page and we will reply within a few days.
        </p>
      </section>
    </div>
  );
}
