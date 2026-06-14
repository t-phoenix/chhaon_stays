import { useEffect } from "react";
import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ChefHat, ListOrdered, PlusCircle, LayoutDashboard, BookOpen, PackageSearch, LogOut, Users as UsersIcon, QrCode } from "lucide-react";
import { startAutoSync } from "@/offline/sync";
import SyncStatusBanner from "@/components/SyncStatusBanner";

const NAV = [
  { to: "/orders", label: "Guests", icon: ListOrdered, testid: "nav-orders", staff: true, admin: true },
  { to: "/orders/new", label: "New", icon: PlusCircle, testid: "nav-new-order", staff: true, admin: true },
  { to: "/kitchen", label: "Kitchen", icon: ChefHat, testid: "nav-kitchen", staff: true, admin: true },
  { to: "/supply", label: "Supply", icon: PackageSearch, testid: "nav-supply", staff: true, admin: true },
  { to: "/menu", label: "Menu", icon: BookOpen, testid: "nav-menu", staff: false, admin: true },
  { to: "/dashboard", label: "Reports", icon: LayoutDashboard, testid: "nav-dashboard", staff: false, admin: true },
];

const ADMIN_EXTRA = { to: "/users", label: "Team", icon: UsersIcon, testid: "nav-users" };

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const items = NAV.filter((n) => (isAdmin ? n.admin : n.staff));
  const mobileItems = isAdmin ? [...items, ADMIN_EXTRA] : items;

  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col overflow-x-hidden">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur bg-bone/85 border-b border-oat/70 safe-top">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate("/orders")}
            className="flex items-center gap-2 text-left min-w-0 shrink"
            data-testid="brand-home-button"
          >
            <span className="inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-sage text-white font-display text-2xl leading-none">C</span>
            <div className="leading-tight min-w-0 hidden min-[380px]:block">
              <div className="font-display text-xl sm:text-2xl text-ink -mb-1 truncate">Chhaon</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink2/80 font-semibold truncate">cafe ops · shoja</div>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-wrap justify-end">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/orders"}
                data-testid={n.testid + "-desktop"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold btn-tactile whitespace-nowrap ${
                    isActive ? "bg-sage text-white shadow-soft" : "text-ink2 hover:bg-cream"
                  }`
                }
              >
                <n.icon className="w-4 h-4 shrink-0" /> {n.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/users"
                data-testid="nav-users-desktop"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold btn-tactile whitespace-nowrap ${
                    isActive ? "bg-sage text-white shadow-soft" : "text-ink2 hover:bg-cream"
                  }`
                }
              >
                <UsersIcon className="w-4 h-4 shrink-0" /> Team
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/mesh/join"
              data-testid="mesh-join-link"
              aria-label="Join mesh"
              title="Join mesh"
              className="w-10 h-10 rounded-xl border border-oat hover:bg-cream flex items-center justify-center btn-tactile text-ink2 hover:text-ink"
            >
              <QrCode className="w-4 h-4" />
            </Link>
            <div className="hidden sm:flex flex-col items-end leading-tight max-w-[120px]">
              <span className="text-sm font-semibold text-ink truncate max-w-full" data-testid="current-user-name">{user?.name}</span>
              <span className="text-[10px] uppercase tracking-widest text-ink2/80">{user?.role}</span>
            </div>
            <button
              onClick={logout}
              data-testid="logout-button"
              className="w-10 h-10 rounded-xl border border-oat hover:bg-cream flex items-center justify-center btn-tactile"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 text-ink2" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-2 sm:py-5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-10 min-w-0">
        <SyncStatusBanner />
        <Outlet />
      </main>

      {/* Mobile bottom nav — scrollable so admin sees all sections */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bone/95 backdrop-blur border-t border-oat safe-bottom"
        data-testid="bottom-nav"
      >
        <div className="flex overflow-x-auto no-scrollbar scroll-touch max-w-6xl mx-auto px-1">
          {mobileItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/orders"}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 min-w-[3.75rem] shrink-0 text-[9px] font-semibold ${
                  isActive ? "text-sage-dark" : "text-ink2/70"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                      isActive ? "bg-sage text-white shadow-soft" : ""
                    }`}
                  >
                    <n.icon className="w-4 h-4" />
                  </span>
                  <span className="truncate max-w-[4.5rem]">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
