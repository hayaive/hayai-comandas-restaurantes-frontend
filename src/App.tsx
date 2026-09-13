import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { FloorPlanPage } from "@/pages/FloorPlanPage";
import { MeseroPage } from "@/pages/MeseroPage";
import { ComandasPage } from "@/pages/ComandasPage";
import { VentasPage } from "@/pages/VentasPage";
import { ReservacionesPage } from "@/pages/ReservacionesPage";
import { ProductosPage } from "@/pages/ProductosPage";
import { CheckInPage } from "@/pages/CheckInPage";
import { EscanearPage } from "@/pages/EscanearPage";
import { SelfSeatPage } from "@/pages/SelfSeatPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      {/* Público — sin sidebar de staff, pensado para abrirse en el teléfono del cliente. */}
      <Route path="/reservar/:codigoPublico" element={<SelfSeatPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/mesas" replace />} />
          <Route path="/mesas" element={<FloorPlanPage />} />
          <Route path="/mesero" element={<MeseroPage />} />
          <Route path="/comandas" element={<ComandasPage />} />
          <Route path="/ventas" element={<VentasPage />} />
          <Route path="/reservaciones" element={<ReservacionesPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
          <Route path="/escanear" element={<EscanearPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
