import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col">
      <EmptyState
        icon={<Compass size={26} />}
        title="Página no encontrada"
        description="La ruta que buscas no existe en Hayai Comandas. Volvamos al plano del salón."
        action={
          <Button variant="primary" asChild>
            <Link to="/mesas">Ir al plano de mesas</Link>
          </Button>
        }
      />
    </div>
  );
}
