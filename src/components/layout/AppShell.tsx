import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TasaBar } from "./TasaBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useFloorPlanBootstrap } from "@/lib/useFloorPlanStore";

export function AppShell() {
  // El plano (salón, plantillas y mesas reales) lo leen Mesas, Mesero,
  // Reservaciones y Comandas. Se carga una sola vez aquí, en el shell de staff,
  // para que ninguna pantalla trabaje con mesas sin `mesaId` real.
  useFloorPlanBootstrap();

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      {/* Campo ambiental: dos manchas de gradiente en movimiento muy lento
          detrás de toda la app. Es la versión barata del fondo animado del
          proyecto de referencia — allí se interpola la propiedad `background`
          de una capa a pantalla completa, lo que repinta cada frame; aquí son
          dos pseudo-elementos estáticos movidos con `transform`, así que viven
          en el compositor y no cuestan repintado. Importa: esta app corre en
          tablets de host-stand. Ver `.ambient-field` en `global.css`. */}
      <div className="ambient-field" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Franja de tasas y barra de navegación mobile: ambas viven en el
          flujo normal del `flex-col` (ninguna es `position: fixed`), así que
          apilan sin solaparse y el AppShell les reserva espacio automática-
          mente — `main` sigue acotado por `h-dvh` + `overflow-hidden` arriba,
          por lo que ninguna pantalla con scroll propio queda tapada. La tasa
          va primero (información de consulta), la navegación al final
          (acción, debe quedar más cerca del pulgar). En `md`+ la navegación
          vuelve a vivir en `Sidebar` y `MobileBottomNav` no renderiza nada
          visible (`md:hidden`). */}
      <div className="relative z-10">
        <TasaBar />
        <MobileBottomNav />
      </div>
    </div>
  );
}
