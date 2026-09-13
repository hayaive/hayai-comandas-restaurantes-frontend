import {
  Armchair,
  CalendarCheck,
  Camera,
  DollarSign,
  Package,
  QrCode,
  Receipt,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Fuente única de las pantallas de staff — la usan tanto `Sidebar`
 * (desktop/tablet) como `MobileBottomNav` + `MobileMoreSheet` (mobile), para
 * que agregar o renombrar una pantalla no requiera tocar tres archivos.
 */
export const navItems: NavItem[] = [
  { to: "/mesas", label: "Mesas", icon: Armchair },
  { to: "/mesero", label: "Mesero", icon: UtensilsCrossed },
  { to: "/comandas", label: "Comandas", icon: Receipt },
  { to: "/reservaciones", label: "Reservaciones", icon: CalendarCheck },
  { to: "/checkin", label: "Check-in", icon: QrCode },
  { to: "/escanear", label: "Escanear", icon: Camera },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/ventas", label: "Ventas", icon: DollarSign },
];
