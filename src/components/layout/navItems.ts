import {
  Armchair,
  CalendarCheck,
  Camera,
  DollarSign,
  Package,
  QrCode,
  Receipt,
  Settings,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuloApp } from "@/api";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Qué módulo de `ModuloApp` gobierna esta pantalla — ver `src/lib/permisos.ts`. */
  modulo: ModuloApp;
}

/**
 * Fuente única de las pantallas de staff — la usan tanto `Sidebar`
 * (desktop/tablet) como `MobileBottomNav` + `MobileMoreSheet` (mobile), para
 * que agregar o renombrar una pantalla no requiera tocar tres archivos. Desde
 * los accesos temporales de meseros, también es la fuente del guard de rutas
 * (`RequireModulo`) y de `primeraPantallaConcedida` — ver `src/lib/permisos.ts`.
 */
export const navItems: NavItem[] = [
  { to: "/mesas", label: "Mesas", icon: Armchair, modulo: "mesas" },
  { to: "/mesero", label: "Mesero", icon: UtensilsCrossed, modulo: "mesero" },
  { to: "/comandas", label: "Despacho", icon: Receipt, modulo: "despacho" },
  { to: "/cuentas", label: "Por cobrar", icon: Wallet, modulo: "por_cobrar" },
  { to: "/reservaciones", label: "Reservaciones", icon: CalendarCheck, modulo: "reservaciones" },
  { to: "/checkin", label: "Check-in", icon: QrCode, modulo: "checkin" },
  { to: "/escanear", label: "Escanear", icon: Camera, modulo: "escanear" },
  { to: "/productos", label: "Productos", icon: Package, modulo: "productos" },
  { to: "/ventas", label: "Ventas", icon: DollarSign, modulo: "ventas" },
  // No está en `PRIMARY_ROUTES` de `MobileBottomNav`, así que cae sola en el
  // menú "Más" de mobile — se calcula por descarte, no hace falta tocar ese
  // archivo para que aparezca ahí.
  { to: "/configuracion", label: "Configuración", icon: Settings, modulo: "configuracion" },
  // Sólo administrador (nadie más recibe el módulo `meseros`) — cae al menú
  // "Más" en mobile igual que Configuración.
  { to: "/meseros", label: "Meseros", icon: Users, modulo: "meseros" },
];
