import { useEffect, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ContentProvider } from "@/context/ContentContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { SiteLayout } from "@/components/layout/SiteLayout";

import Home from "@/pages/Home";

// Public routes are also lazy-loaded so the Home bundle stays as small as
// possible. Most visitors land on / and never click further — there's no
// reason to ship Gallery/Pricing/Contact code on first load.
const Gallery = lazy(() => import("@/pages/Gallery"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Contact = lazy(() => import("@/pages/Contact"));
const About = lazy(() => import("@/pages/About"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const CookiesPolicy = lazy(() => import("@/pages/CookiesPolicy"));

// Admin pages are lazy-loaded so the public marketing site (which is what
// the vast majority of visitors hit) doesn't have to download ~150 KB of
// admin-only JS. Each admin route becomes its own chunk fetched on demand.
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const HeroManager = lazy(() => import("@/pages/admin/HeroManager"));
const GalleryManager = lazy(() => import("@/pages/admin/GalleryManager"));
const JourneysManager = lazy(() => import("@/pages/admin/JourneysManager"));
const AboutManager = lazy(() => import("@/pages/admin/AboutManager"));
const BlogManager = lazy(() => import("@/pages/admin/BlogManager"));
const Submissions = lazy(() => import("@/pages/admin/Submissions"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const WebsiteText = lazy(() => import("@/pages/admin/WebsiteText"));
const WebsiteMedia = lazy(() => import("@/pages/admin/WebsiteMedia"));

// Lightweight fallback shown while a route chunk is being fetched. Kept
// minimal (no branding, no animation) so the perceived delay is near-zero.
const RouteFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center bg-[#FAF7F2]">
    <div className="text-[#2D4A3E] text-sm tracking-widest uppercase opacity-60">Loading…</div>
  </div>
);

// Backwards-compat alias so the admin chunks keep the friendlier label.
const AdminFallback = RouteFallback;

// Keeps /admin out of search indexes at runtime.
function RobotsMeta() {
  const location = useLocation();
  useEffect(() => {
    const isAdmin = location.pathname.startsWith("/admin");
    let tag = document.querySelector('meta[name="robots"]');
    if (isAdmin) {
      if (!tag) { tag = document.createElement("meta"); tag.name = "robots"; document.head.appendChild(tag); }
      tag.content = "noindex, nofollow";
    } else if (tag) {
      tag.content = "index, follow";
    }
  }, [location.pathname]);
  return null;
}

const Public = ({ children }) => <SiteLayout>{children}</SiteLayout>;

function App() {
  return (
    <div className="App">
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <SettingsProvider>
              <ContentProvider>
                <RobotsMeta />
                <PageTransition>
                  <Routes>
                    <Route path="/" element={<Public><Home /></Public>} />
                    <Route path="/gallery" element={<Public><Suspense fallback={<RouteFallback />}><Gallery /></Suspense></Public>} />
                    <Route path="/pricing" element={<Public><Suspense fallback={<RouteFallback />}><Pricing /></Suspense></Public>} />
                    <Route path="/contact" element={<Public><Suspense fallback={<RouteFallback />}><Contact /></Suspense></Public>} />
                    <Route path="/about" element={<Public><Suspense fallback={<RouteFallback />}><About /></Suspense></Public>} />
                    <Route path="/blog" element={<Public><Suspense fallback={<RouteFallback />}><Blog /></Suspense></Public>} />
                    <Route path="/blog/:slug" element={<Public><Suspense fallback={<RouteFallback />}><BlogPost /></Suspense></Public>} />
                    <Route path="/cookies" element={<Public><Suspense fallback={<RouteFallback />}><CookiesPolicy /></Suspense></Public>} />

                    {/* Admin (unlinked, noindex) — each route is a separate
                        chunk wrapped in Suspense so the public bundle stays
                        small. */}
                    <Route path="/admin" element={<Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>} />
                    <Route path="/admin/dashboard" element={<Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
                    <Route path="/admin/hero" element={<Suspense fallback={<AdminFallback />}><HeroManager /></Suspense>} />
                    <Route path="/admin/gallery" element={<Suspense fallback={<AdminFallback />}><GalleryManager /></Suspense>} />
                    <Route path="/admin/journeys" element={<Suspense fallback={<AdminFallback />}><JourneysManager /></Suspense>} />
                    <Route path="/admin/about" element={<Suspense fallback={<AdminFallback />}><AboutManager /></Suspense>} />
                    <Route path="/admin/blog" element={<Suspense fallback={<AdminFallback />}><BlogManager /></Suspense>} />
                    <Route path="/admin/website-text" element={<Suspense fallback={<AdminFallback />}><WebsiteText /></Suspense>} />
                    <Route path="/admin/website-media" element={<Suspense fallback={<AdminFallback />}><WebsiteMedia /></Suspense>} />
                    <Route path="/admin/submissions" element={<Suspense fallback={<AdminFallback />}><Submissions /></Suspense>} />
                    <Route path="/admin/settings" element={<Suspense fallback={<AdminFallback />}><AdminSettings /></Suspense>} />
                  </Routes>
                </PageTransition>
              </ContentProvider>
            </SettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </div>
  );
}

export default App;
