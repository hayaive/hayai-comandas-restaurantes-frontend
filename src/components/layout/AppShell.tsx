import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TasaBar } from "./TasaBar";
import { useFloorPlanBootstrap } from "@/lib/useFloorPlanStore";

export function AppShell() {
  // El plano (salón, plantillas y mesas reales) lo leen Mesas, Mesero,
  // Reservaciones y Comandas. Se carga una sola vez aquí, en el shell de staff,
  // para que ninguna pantalla trabaje con mesas sin `mesaId` real.
  useFloorPlanBootstrap();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
      {/* Franja de tasas: visible desde cualquier pantalla de staff sin tapar
          el contenido con scroll propio (no es `position: fixed`), y no
          interfiere con el ajuste mobile del Sidebar porque vive fuera de su
          fila. */}
      <TasaBar />
    </div>
  );
}
