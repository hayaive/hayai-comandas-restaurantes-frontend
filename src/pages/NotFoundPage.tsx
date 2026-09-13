import { Link } from "react-router-dom";
import { Compass } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col">
      <EmptyState
        icon={<Compass size={26} weight="duotone" />}
        title="Página no encontrada"
        description="La ruta que buscas no existe en Hayai Comandas."
        action={
          <Link
            to="/mesas"
            className="mt-1 inline-flex h-9 items-center justify-center rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-medium text-fg-on-accent transition-colors duration-150 hover:bg-accent-strong"
          >
            Ir al plano de mesas
          </Link>
        }
      />
    </div>
  );
}
