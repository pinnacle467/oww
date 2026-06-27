import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StickyCTA } from "@/components/layout/StickyCTA";
import { ExitIntentModal } from "@/components/ui/ExitIntentModal";
import { CookieBanner } from "@/components/CookieBanner";

export function SiteLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <StickyCTA />
      <ExitIntentModal />
      <CookieBanner />
    </div>
  );
}

export default SiteLayout;
