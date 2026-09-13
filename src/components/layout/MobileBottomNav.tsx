import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { DotsThreeCircle, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { navItems } from "./navItems";
import { MobileMoreSheet } from "./MobileMoreSheet";

/**
 * Barra de navegación inferior, exclusiva de mobile (`md:hidden`) — sustituye
 * al `Sidebar` angosto de 76px, que en un teléfono se comía espacio
 * horizontal crítico y no es cómodo de alcanzar con el pulgar.
 *
 * Máximo 5 opciones visibles, patrón FAB-en-tab-bar:
 *   Mesas · Comandas · [Agregar Orden] · Reservaciones · Más
 *
 * Por qué estas 3 pantallas fijas (+ el FAB): Mesas, Comandas y
 * Reservaciones son el ciclo de servicio que el mesero/host recorre en cada
 * mesa — junto con "Agregar Orden" (Mesero) son las cuatro que se tocan
 * constantemente durante el turno. Con el límite de 5 slots totales y la
 * regla de agrupar el resto detrás de "Más", ese quinto slot lo ocupa el
 * propio botón "Más" en vez de una cuarta pantalla — ahí quedan Check-in,
 * Escanear, Productos y Ventas (uso más esporádico o de un rol específico:
 * host en la puerta, cajero al cerrar, administración del catálogo).
 *
 * Se renderiza en el flujo normal del layout (no `position: fixed`), igual
 * que `TasaBar` y `BottomToolbar` — así el AppShell reserva su espacio
 * automáticamente dentro del `flex-col` acotado por `h-dvh`, sin necesitar
 * padding-bottom calculado a mano en cada pantalla con scroll, y sin riesgo
 * de taparlas.
 */

const FAB_ROUTE = "/mesero";
const FAB_LABEL = "Agregar Orden";

const PRIMARY_ROUTES = ["/mesas", "/comandas", "/reservaciones"];
// Orden explícito Mesas → Comandas → (FAB) → Reservaciones, independiente
// del orden de declaración en `navItems`.
const [mesasItem, comandasItem, reservacionesItem] = PRIMARY_ROUTES.map(
  (to) => navItems.find((item) => item.to === to)!,
);

const moreItems = navItems.filter(
  (item) => ![FAB_ROUTE, ...PRIMARY_ROUTES].includes(item.to),
);

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="grid shrink-0 grid-cols-5 border-t border-nav-border bg-nav-bg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 md:hidden"
      >
        <NavTab item={mesasItem} />
        <NavTab item={comandasItem} />

        <NavLink
          to={FAB_ROUTE}
          className="relative flex flex-col items-center justify-end gap-1 pb-0.5"
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "-mt-7 flex h-14 w-14 items-center justify-center rounded-full text-fg-on-accent shadow-[var(--shadow-token-lg)] ring-4 ring-nav-bg transition-transform duration-150 active:scale-95",
                  isActive ? "bg-accent-strong" : "bg-accent",
                )}
              >
                <Plus size={26} weight="bold" />
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-medium",
                  isActive ? "text-nav-fg" : "text-nav-fg-muted",
                )}
              >
                {FAB_LABEL}
              </span>
            </>
          )}
        </NavLink>

        <NavTab item={reservacionesItem} />

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10.5px] font-medium transition-colors duration-150",
            isMoreActive ? "text-accent" : "text-nav-fg-muted hover:text-nav-fg",
          )}
        >
          <DotsThreeCircle size={20} weight={isMoreActive ? "fill" : "duotone"} />
          Más
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
    </>
  );
}

function NavTab({ item }: { item: (typeof navItems)[number] }) {
  const { to, label, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10.5px] font-medium transition-colors duration-150",
          isActive ? "text-accent" : "text-nav-fg-muted hover:text-nav-fg",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} weight={isActive ? "fill" : "duotone"} />
          {label}
        </>
      )}
    </NavLink>
  );
}
