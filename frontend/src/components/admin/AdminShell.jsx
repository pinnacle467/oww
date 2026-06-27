import { Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Images, Image, Type, FileImage, Inbox, Settings, LogOut, Loader2, Map, BookOpen, Newspaper } from "lucide-react";

const LINKS = [
  { to: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/admin/website-text", label: "Website Text", icon: Type },
  { to: "/admin/website-media", label: "Website Images & Videos", icon: FileImage },
  { to: "/admin/hero", label: "Hero Slideshow", icon: Images },
  { to: "/admin/gallery", label: "Gallery Photos & Videos", icon: Image },
  { to: "/admin/journeys", label: "Trips & Journeys", icon: Map },
  { to: "/admin/about", label: "About Us & Stories", icon: BookOpen },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/submissions", label: "Messages", icon: Inbox },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }) {
  const { admin, checking, logout } = useAuth();
  const navigate = useNavigate();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F2EE]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2D4A3E]" />
      </div>
    );
  }
  if (!admin || !admin.id) return <Navigate to="/admin" replace />;

  const handleLogout = () => { logout(); navigate("/admin"); };

  return (
    <div className="min-h-screen bg-[#F4F2EE] flex flex-col lg:flex-row" data-testid="admin-shell">
      <aside className="lg:w-72 bg-[#2D4A3E] text-white lg:min-h-screen flex lg:flex-col">
        <div className="p-6 hidden lg:block">
          <img src="/assets/logo-nav-white.png" alt="Once Were Wild" className="h-14" />
          <p className="text-sm text-white/60 mt-3">Website Manager</p>
        </div>
        <nav className="flex lg:flex-col gap-1 p-3 lg:p-4 overflow-x-auto w-full">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium whitespace-nowrap transition-colors ${isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`
              }
              data-testid={`admin-nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}>
              <l.icon className="h-5 w-5 shrink-0" />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout}
          className="hidden lg:flex items-center gap-3 mt-auto m-4 rounded-md px-4 py-3 text-base font-medium text-white/75 hover:bg-white/10 hover:text-white transition-colors"
          data-testid="admin-logout">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </aside>
      <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-6xl">{children}</main>
    </div>
  );
}

export default AdminShell;
