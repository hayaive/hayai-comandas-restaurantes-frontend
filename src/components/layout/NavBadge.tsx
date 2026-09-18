import { cn } from "@/lib/cn";
import { useComandaStore } from "@/lib/useComandaStore";

/**
 * Badge numérico de conteo sobre un icono de navegación — un solo componente
 * para `MobileBottomNav` y `Sidebar`, así el look no puede divergir entre
 * mobile y desktop.
 *
 * Fill sólido (`bg-destructive`/`text-destructive-foreground`, el mismo par
 * que ya usa el botón destructivo) en vez del tono suave `danger`/`danger-soft`
 * de `Badge`: ese par está pensado para texto sentado sobre una superficie
 * plana, y este badge tiene que leerse sobre DOS fondos distintos según el
 * item esté activo o no — la píldora marrón (`bg-active`) o el fondo normal
 * de la barra. Un `ring` del color de fondo de la app alrededor lo separa de
 * cualquiera de los dos en vez de depender de que el rojo contraste con el
 * marrón (que no está garantizado).
 *
 * `aria-hidden`: el número NO es un nodo de texto independiente para el
 * lector de pantalla. Ya viaja dentro del nombre accesible del item —ver
 * `useNavItemBadge`— porque un `<span>` visual aparte se anunciaría una
 * segunda vez además de duplicar el texto del `sr-only` del propio link.
 */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-[var(--radius-pill)]",
        "border-2 border-bg bg-destructive px-1 font-tabular text-[9px] font-semibold leading-none text-destructive-foreground",
        className,
      )}
    >
      {display}
    </span>
  );
}

/** Texto para singular/plural en español, sin librería de i18n de por medio. */
function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

interface NavItemBadge {
  count: number;
  /** Se concatena al label del item para formar su nombre accesible completo. */
  srSuffix: string;
}

/**
 * Conteo (si aplica) para el icono de navegación de una ruta dada.
 *
 * Sólo "/comandas" (Despacho) y "/cuentas" (Por cobrar) tienen badge — el
 * resto de `navItems` no representa una cola ni un pendiente por cobrar, así
 * que no hay nada que contar. Devuelve `null` tanto para rutas sin badge como
 * para conteo en cero: en ambos casos no se renderiza nada.
 */
export function useNavItemBadge(to: string): NavItemBadge | null {
  const colaCount = useComandaStore((state) => state.cola.length);
  const cuentasCount = useComandaStore((state) => state.cuentas.length);

  if (to === "/comandas") {
    if (colaCount <= 0) return null;
    return {
      count: colaCount,
      srSuffix: `${colaCount} ${pluralize(colaCount, "pedido en cola", "pedidos en cola")}`,
    };
  }

  if (to === "/cuentas") {
    if (cuentasCount <= 0) return null;
    return {
      count: cuentasCount,
      srSuffix: `${cuentasCount} ${pluralize(cuentasCount, "cuenta pendiente", "cuentas pendientes")}`,
    };
  }

  return null;
}
