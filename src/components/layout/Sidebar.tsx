import { NavLink, useNavigate } from "react-router-dom";
import { Download, LogOut } from "lucide-react";

import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { IconButton } from "@/components/ui/IconButton";
import { useAuthStore } from "@/lib/useAuthStore";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { navItems } from "./navItems";

/**
 * The desktop/tablet navigation rail.
 *
 * Structure is the reference dashboard's sidebar: a brand block (mark + name +
 * quiet subtitle), the nav list, then a utility strip separated by a single
 * `border-t`. One continuous surface throughout — the previous version painted
 * the body in kraft and the foot in solid black, and that two-tone split was
 * retired with the coffee identity (the reasoning lives in `tokens.css`).
 *
 * Responsive behaviour is unchanged and deliberately *not* the reference's:
 * below `md` navigation moves to `MobileBottomNav`, from `md` to `lg` this is
 * a 76px icon rail, and only at `lg`+ does it become the labelled column. The
 * reference's collapse-toggle would cost a tap on a host-stand tablet that has
 * exactly one job on screen; the breakpoint decides instead.
 *
 * ACTIVE STATE: brown fill, white text — the client override. This is the most
 * visible instance of it in the product, so it is the one to check first if
 * the rule ever looks like it has drifted.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { canInstall, promptInstall } = useInstallPrompt();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="relative z-10 hidden w-[76px] shrink-0 flex-col border-r border-border bg-bg/80 backdrop-blur-sm md:flex lg:w-[240px]">
      <div className="flex items-center gap-3 px-3 py-4 lg:px-4">
        <BrandMark size={40} className="rounded-[var(--radius-md)]" />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold leading-tight text-fg">Coffee &amp; Cake</p>
          <p className="truncate text-[12px] text-fg-muted">Comandas</p>
        </div>
      </div>

      <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1 px-2 lg:px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2.5 text-[13px] font-medium",
                "transition-colors duration-150 lg:px-3",
                "flex-col justify-center lg:flex-row lg:justify-start",
                isActive
                  ? "bg-active text-active-fg"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )
            }
          >
            <Icon size={20} strokeWidth={2} className="shrink-0" />
            <span className="text-[10.5px] lg:text-[13px]">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 flex items-center justify-center gap-1 border-t border-border px-2 py-3 lg:justify-start lg:px-3">
        <ThemeToggle />
        {canInstall && (
          <IconButton
            icon={<Download size={17} />}
            label="Instalar app"
            onClick={promptInstall}
          />
        )}
        <IconButton
          icon={<LogOut size={17} />}
          label="Cerrar sesión"
          onClick={handleLogout}
        />
      </div>
    </aside>
  );
}
