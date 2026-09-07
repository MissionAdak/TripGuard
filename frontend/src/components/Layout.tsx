import { NavLink, Outlet } from "react-router-dom";
import { Shield } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/operations", label: "Operations" },
  { to: "/traveler", label: "Traveler Dashboard" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <NavLink to="/" className="font-bold text-xl tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground">
              <Shield className="w-4 h-4" />
            </div>
            TRIPGUARD
          </NavLink>
          <nav className="flex gap-1 text-sm font-medium">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition-colors ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
