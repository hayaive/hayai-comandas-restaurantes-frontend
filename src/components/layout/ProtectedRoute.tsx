import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/lib/useAuthStore";

/**
 * Wraps the staff-only route tree (`/mesas`, `/comandas`, `/reservaciones`,
 * `/productos`, `/ventas`, `/checkin` — everything under `AppShell`).
 * Public customer-facing routes (`/reservar/:codigo`) are never nested under
 * this guard. In mock mode (`isUsingMockAuth`, no `VITE_API_URL`) the store's
 * `isAuthenticated` is always true, so local dev without a backend is
 * unaffected.
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
