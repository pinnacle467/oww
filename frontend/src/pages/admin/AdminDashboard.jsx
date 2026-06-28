import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AdminShell } from "@/components/admin/AdminShell";
import { Images, Image, Type, FileImage, Inbox, ArrowRight, Map, BookOpen, Newspaper, HelpCircle, FileText } from "lucide-react";

export default function AdminDashboard() {
  useEffect(() => { document.title = "Dashboard | Once Were Wild Admin"; }, []);
  const { admin } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const tiles = [
    { to: "/admin/website-text", label: "Website Text", desc: "Edit headlines, paragraphs and labels across the site", icon: Type, color: "#4A7C6F" },
    { to: "/admin/website-media", label: "Website Images & Videos", desc: "Replace every photo and video on your website", icon: FileImage, color: "#2E6DA4" },
    { to: "/admin/hero", label: "Hero Carousel", desc: "The big rotating photos on your home page", icon: Images, color: "#2E6DA4" },
    { to: "/admin/gallery", label: "Gallery Photos & Videos", desc: "Manage your photo and video gallery", icon: Image, color: "#4A7C6F" },
    { to: "/admin/journeys", label: "Trips & Journeys", desc: "Add, edit and price the trip cards on /pricing — upload itinerary PDFs", icon: Map, color: "#B8923D" },
    { to: "/admin/home-content", label: "Home Content", desc: "Long-form rich-text sections in the lower half of the home page", icon: FileText, color: "#2E6DA4" },
    { to: "/admin/home-faqs", label: "Home FAQs", desc: "The Questions Gently Answered accordion on the home page", icon: HelpCircle, color: "#4A7C6F" },
    { to: "/admin/about", label: "About Us & Stories", desc: "Edit the /about text blocks and manage the trip story blog", icon: BookOpen, color: "#4A7C6F" },
    { to: "/admin/blog", label: "Blog", desc: "Write standalone travel posts shown on /blog", icon: Newspaper, color: "#B8923D" },
    { to: "/admin/submissions", label: "Messages", desc: "Read enquiries from your website", icon: Inbox, color: "#2D4A3E" },
  ];

  return (
    <AdminShell>
      <div data-testid="admin-dashboard">
        <p className="text-lg text-gray-500">Welcome back</p>
        <h1 className="text-3xl font-semibold text-[#1C1C1C] mb-8">Once Were Wild</h1>

        {/* Quick stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="stat-gallery">
            <p className="text-4xl font-semibold text-[#2D4A3E]">{stats ? stats.gallery : "–"}</p>
            <p className="text-base text-gray-500 mt-1">Photos in your gallery</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="stat-submissions">
            <p className="text-4xl font-semibold text-[#2D4A3E]">{stats ? stats.total_submissions : "–"}</p>
            <p className="text-base text-gray-500 mt-1">Total messages received</p>
          </div>
          <div className="bg-[#2D4A3E] rounded-lg p-6" data-testid="stat-unread">
            <p className="text-4xl font-semibold text-white">{stats ? stats.unread_submissions : "–"}</p>
            <p className="text-base text-white/70 mt-1">New, unread messages</p>
          </div>
        </div>

        {/* Navigation tiles */}
        <div className="grid sm:grid-cols-2 gap-4">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to}
              className="group bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-5 hover:shadow-lg hover:border-gray-300 transition-all"
              data-testid={`tile-${t.label.toLowerCase().replace(/\s/g, "-")}`}>
              <span className="rounded-lg p-4 text-white shrink-0" style={{ backgroundColor: t.color }}>
                <t.icon className="h-7 w-7" />
              </span>
              <span className="flex-1">
                <span className="block text-xl font-semibold text-[#1C1C1C]">{t.label}</span>
                <span className="block text-base text-gray-500">{t.desc}</span>
              </span>
              <ArrowRight className="h-6 w-6 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
