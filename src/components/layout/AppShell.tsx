import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useFloorPlanBootstrap } from "@/lib/useFloorPlanStore";

export function AppShell() {
  // El plano (salón, plantillas y mesas reales) lo leen Mesas, Mesero,
  // Reservaciones y Comandas. Se carga una sola vez aquí, en el shell de staff,
  // para que ninguna pantalla trabaje con mesas sin `mesaId` real.
  useFloorPlanBootstrap();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-fg">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
