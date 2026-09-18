import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import { useAuthStore } from "@/lib/useAuthStore";
import { tieneModulo } from "@/lib/permisos";
import { navItems } from "./navItems";
import type { NavItem } from "./navItems";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { NavBadge, useNavItemBadge } from "./NavBadge";

/**
 * Barra de navegación inferior, exclusiva de mobile (`md:hidden`) — sustituye
 * al `Sidebar` angosto de 76px, que en un teléfono se comía espacio
 * horizontal crítico y no es cómodo de alcanzar con el pulgar.
 *
 * Máximo 5 opciones visibles, patrón FAB-en-tab-bar:
 *   Mesas · Comandas · [Agregar Orden] · Por cobrar · Más
 *
 * Por qué estas 3 pantallas fijas (+ el FAB): Mesas, Comandas y Por cobrar
 * son el ciclo de servicio que el mesero/host recorre en cada mesa —sentar,
 * despachar lo que sale de cocina, cobrar— junto con "Agregar Orden"
 * (Mesero) son las cuatro que se tocan constantemente durante el turno.
 * Reservaciones, que ocupaba este tercer slot antes, se movió a "Más": es
 * una consulta puntual (host en la puerta), no un paso que se repite por
 * cada mesa en cada turno, y Por cobrar SÍ lo es — además ahora lleva un
 * badge con las cuentas pendientes (igual que Comandas con su cola), y ese
 * aviso sólo cumple su función si la pantalla está entre las fijas, visible
 * sin abrir "Más". Con el límite de 5 slots totales y la regla de agrupar el
 * resto detrás de "Más", ese quinto slot lo ocupa el propio botón "Más" en
 * vez de una cuarta pantalla — ahí quedan Reservaciones, Check-in, Escanear,
 * Productos y Ventas (uso más esporádico o de un rol específico: host en la
 * puerta, cajero al cerrar, administración del catálogo).
 *
 * Se renderiza en el flujo normal del layout (no `position: fixed`), igual
 * que `TasaBar` y `BottomToolbar` — así el AppShell reserva su espacio
 * automáticamente dentro del `flex-col` acotado por `h-dvh`, sin necesitar
 * padding-bottom calculado a mano en cada pantalla con scroll.
 *
 * SÓLO ICONOS: los rótulos se quitaron de la vista a pedido del cliente —en
 * un teléfono angosto cinco etiquetas de 10.5px se truncaban y ensuciaban más
 * de lo que orientaban. Siguen en el árbol como `sr-only`, que es lo que le da
 * nombre accesible a cada pestaña; sin eso un lector de pantalla anunciaría
 * sólo "enlace". Cada slot conserva 44px de alto mínimo para que el objetivo
 * de toque no encoja con el texto.
 *
 * REDISEÑO: la barra ya no es el bloque negro del sistema anterior; ahora es
 * la misma superficie translúcida del resto del chrome. La pestaña activa
 * lleva la píldora MARRÓN con texto blanco (override del cliente), que en una
 * barra clara se lee muchísimo mejor que el antiguo cambio de color de texto
 * sobre negro. El FAB conserva su propio gradiente de marca (`.hero-brand`,
 * ahora también marrón — ya no queda morado en ningún botón del producto),
 * distinto del marrón plano `bg-active`: es una acción, no un estado.
 *
 * ACCESOS TEMPORALES — por qué la grilla ya no es un `grid-cols-5` fijo:
 * un mesero temporal puede tener un solo módulo concedido (típicamente sólo
 * "mesero"). Con la grilla de 5 huecos fija, eso dejaba slots VACÍOS (mal:
 * espacio muerto y descuadrado) o, peor, botones que SIGUEN llevando a
 * pantallas de otros módulos y revientan en un 403 al tocarlos. La solución:
 * cada slot fijo (Mesas/Comandas/[FAB Mesero]/Por cobrar) se omite si el
 * usuario no tiene ese módulo, y la grilla se dimensiona al número real de
 * slots que quedan (`gridColsClass`, 1 a 5 columnas — Tailwind necesita la
 * clase completa en el código para el JIT, así que es un mapa, no un string
 * interpolado). "Más" NUNCA se omite, aunque `moreItems` quede vacío: en
 * mobile el Sidebar está oculto, así que ese botón es la ÚNICA forma de
 * cambiar el tema o cerrar sesión — un mesero con un solo módulo lo sigue
 * necesitando igual que el administrador.
 */

const FAB_ROUTE = "/mesero";
const FAB_LABEL = "Agregar Orden";

const PRIMARY_ROUTES = ["/mesas", "/comandas", "/cuentas"];
// Orden explícito Mesas → Comandas → (FAB) → Por cobrar, independiente del
// orden de declaración en `navItems`.
const [mesasItem, comandasItem, cuentasItem] = PRIMARY_ROUTES.map(
  (to) => navItems.find((item) => item.to === to)!,
);
const fabItem = navItems.find((item) => item.to === FAB_ROUTE)!;

const allMoreItems = navItems.filter((item) => ![FAB_ROUTE, ...PRIMARY_ROUTES].includes(item.to));

/** Tailwind necesita la clase LITERAL en el código para que el JIT la genere. */
const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const usuario = useAuthStore((s) => s.usuario);
  const modulosListos = useAuthStore((s) => s.modulosListos);

  const puede = (item: NavItem) => tieneModulo(usuario, modulosListos, item.modulo);

  const visiblePrimary = [mesasItem, comandasItem, cuentasItem].filter(puede);
  const hasFab = puede(fabItem);
  const moreItems = allMoreItems.filter(puede);
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  // Mesas/Comandas antes del FAB, Por cobrar después — mismo orden visual de
  // siempre, sólo que ahora cada uno puede faltar. "Más" cierra la fila
  // siempre.
  const before = visiblePrimary.filter((item) => item.to !== "/cuentas");
  const after = visiblePrimary.filter((item) => item.to === "/cuentas");
  const totalSlots = before.length + (hasFab ? 1 : 0) + after.length + 1;

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className={cn(
          "grid shrink-0 gap-1 border-t border-border bg-bg/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-md md:hidden",
          GRID_COLS_CLASS[Math.min(5, Math.max(1, totalSlots))],
        )}
      >
        {before.map((item) => (
          <NavTab key={item.to} item={item} />
        ))}

        {hasFab && (
          <NavLink to={FAB_ROUTE} className="relative flex min-h-11 items-center justify-center">
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "-mt-7 flex size-14 items-center justify-center rounded-[var(--radius-md)] text-white",
                    "hero-brand shadow-[var(--shadow-token-lg)] ring-4 ring-bg",
                    "transition-transform duration-150 active:scale-95",
                    isActive && "ring-active",
                  )}
                >
                  <Plus size={26} strokeWidth={2.5} />
                </span>
                <span className="sr-only">{FAB_LABEL}</span>
              </>
            )}
          </NavLink>
        )}

        {after.map((item) => (
          <NavTab key={item.to} item={item} />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-1 py-1.5",
            "transition-colors duration-150",
            isMoreActive
              ? "bg-active text-active-fg"
              : "text-fg-muted hover:bg-surface-hover hover:text-fg",
          )}
        >
          <MoreHorizontal size={22} />
          <span className="sr-only">Más</span>
        </button>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
    </>
  );
}

function NavTab({ item }: { item: (typeof navItems)[number] }) {
  const { to, label, icon: Icon } = item;
  const badge = useNavItemBadge(to);
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-1 py-1.5",
          "transition-colors duration-150",
          isActive
            ? "bg-active text-active-fg"
            : "text-fg-muted hover:bg-surface-hover hover:text-fg",
        )
      }
    >
      <span className="relative inline-flex">
        <Icon size={22} />
        {badge && <NavBadge count={badge.count} />}
      </span>
      {/* El texto se va de la pantalla, no del árbol: sin él la pestaña queda
          sin nombre accesible y un lector de pantalla sólo anunciaría "enlace".
          La píldora marrón sigue diciendo cuál está activa. El conteo se suma
          al mismo nodo `sr-only` en vez de vivir en un `<span>` propio junto
          al `NavBadge` (que es `aria-hidden`) — así el lector de pantalla lo
          anuncia UNA vez, como parte del nombre del link ("Por cobrar, 3
          cuentas pendientes"), no como un adorno visual suelto. */}
      <span className="sr-only">
        {label}
        {badge ? `, ${badge.srSuffix}` : ""}
      </span>
    </NavLink>
  );
}
