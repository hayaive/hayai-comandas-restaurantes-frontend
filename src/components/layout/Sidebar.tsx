import { NavLink, useNavigate } from "react-router-dom";
import { SignOut } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { IconButton } from "@/components/ui/IconButton";
import { useAuthStore } from "@/lib/useAuthStore";
import { navItems } from "./navItems";

export function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    // Oculto por debajo de `md`: en ese rango la navegación vive en
    // `MobileBottomNav` (barra inferior). De `md` a `lg` sigue siendo la
    // columna angosta de solo íconos; a partir de `lg`, la columna con
    // etiquetas — sin cambios respecto al comportamiento previo.
    <aside className="hidden w-[76px] flex-col items-center gap-1 border-r border-nav-border bg-nav-bg py-4 md:flex lg:w-[220px] lg:items-stretch lg:px-3">
      <div className="mb-4 flex items-center gap-2 px-2 lg:px-1">
        <BrandMark onDark />
        <span className="hidden text-[14px] font-semibold tracking-tight text-nav-fg lg:inline">
          Hayai Comandas
        </span>
      </div>

      <nav className="flex w-full flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 lg:justify-start",
                "flex-col justify-center lg:flex-row",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-nav-fg-muted hover:bg-nav-bg-hover hover:text-nav-fg",
              )
            }
          >
            <Icon size={20} weight="duotone" />
            <span className="text-[10.5px] lg:text-[13px]">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex w-full items-center justify-center gap-2 px-2 pt-3 lg:justify-start lg:px-1">
        <ThemeToggle variant="nav" />
        <IconButton
          variant="nav"
          icon={<SignOut size={17} weight="bold" />}
          label="Cerrar sesión"
          onClick={handleLogout}
        />
      </div>
    </aside>
  );
}
