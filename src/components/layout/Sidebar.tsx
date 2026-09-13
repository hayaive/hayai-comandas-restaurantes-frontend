import { NavLink } from "react-router-dom";
import {
  Armchair,
  CalendarCheck,
  CurrencyDollar,
  Package,
  QrCode,
  Receipt,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navItems = [
  { to: "/mesas", label: "Mesas", icon: Armchair },
  { to: "/comandas", label: "Comandas", icon: Receipt },
  { to: "/reservaciones", label: "Reservaciones", icon: CalendarCheck },
  { to: "/checkin", label: "Check-in", icon: QrCode },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/ventas", label: "Ventas", icon: CurrencyDollar },
];

export function Sidebar() {
  return (
    <aside className="flex w-[76px] flex-col items-center gap-1 border-r border-border bg-surface py-4 lg:w-[220px] lg:items-stretch lg:px-3">
      <div className="mb-4 flex items-center gap-2 px-2 lg:px-1">
        <BrandMark />
        <span className="hidden text-[14px] font-semibold tracking-tight text-fg lg:inline">
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
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )
            }
          >
            <Icon size={20} weight="duotone" />
            <span className="text-[10.5px] lg:text-[13px]">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex w-full items-center justify-center px-2 pt-3 lg:justify-start lg:px-1">
        <ThemeToggle />
      </div>
    </aside>
  );
}
