import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import { Download, LogOut, Moon, Sun, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";
import { useAuthStore } from "@/lib/useAuthStore";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { useTheme } from "@/lib/useTheme";

interface MoreItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  items: MoreItem[];
}

/**
 * Hoja inferior con el resto de las pantallas que no caben en los 5 slots
 * de `MobileBottomNav`, más el tema y cerrar sesión — en desktop esas dos
 * últimas acciones viven en el pie del `Sidebar`; en mobile el Sidebar está
 * oculto, así que este es el único lugar donde quedan disponibles.
 * Mismo patrón visual que `MobileTableSheet` (bottom sheet con backdrop y
 * manija), reutilizado en vez de inventar un segundo patrón de overlay.
 *
 * El ítem activo usa el marrón del cliente, igual que el rail y la tab bar.
 */
export function MobileMoreSheet({ open, onClose, items }: MobileMoreSheetProps) {
  const [entered, setEntered] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { canInstall, promptInstall } = useInstallPrompt();

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleLogout() {
    onClose();
    logout();
    navigate("/login", { replace: true });
  }

  function handleInstall() {
    onClose();
    void promptInstall();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
      <div
        className={cn(
          "absolute inset-0 bg-[var(--overlay)] backdrop-blur-[3px] transition-opacity duration-200",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[75dvh] flex-col rounded-t-[var(--radius-lg)] border-t border-border bg-surface shadow-[var(--shadow-token-lg)] transition-transform duration-200 ease-out",
          "pb-[max(env(safe-area-inset-bottom),1rem)]",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex justify-center pt-2.5" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <span className="text-lg font-semibold text-fg">Más opciones</span>
          <IconButton icon={<X size={16} />} label="Cerrar" size="sm" onClick={onClose} />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-1">
            {items.map(({ to, label, icon: ItemIcon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "bg-active text-active-fg"
                        : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                    )
                  }
                >
                  <ItemIcon size={20} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex flex-1 items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            {isDark ? "Tema claro" : "Tema oscuro"}
          </button>
          {canInstall && (
            <button
              type="button"
              onClick={handleInstall}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg"
            >
              <Download size={20} />
              Instalar
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
          >
            <LogOut size={20} />
            Salir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
