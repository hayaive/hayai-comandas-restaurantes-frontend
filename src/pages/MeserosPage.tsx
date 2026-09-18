import { useEffect, useState } from "react";
import { AlertTriangle, MoreVertical, Pencil, Plus, RotateCw, Trash2, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageBody, Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { navItems } from "@/components/layout/navItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/primitives/dropdown-menu";
import { useAccesoStore } from "@/lib/useAccesoStore";
import { formatDateTime } from "@/lib/format";
import { AccesoFormModal } from "@/components/meseros/AccesoFormModal";
import { SecretoAccesoModal } from "@/components/meseros/SecretoAccesoModal";
import { RegenerarAccesoModal } from "@/components/meseros/RegenerarAccesoModal";
import type { AccesoCreadoResult, AccesoTemporal, ModuloApp } from "@/api";

/** Umbral que pide el brief para avisar que alguien está probando códigos contra este acceso. */
const UMBRAL_FALLOS_SOSPECHOSOS = 10;

const LABEL_POR_MODULO = new Map<ModuloApp, string>(navItems.map((item) => [item.modulo, item.label]));

export function MeserosPage() {
  const accesos = useAccesoStore((s) => s.accesos);
  const status = useAccesoStore((s) => s.status);
  const error = useAccesoStore((s) => s.error);
  const load = useAccesoStore((s) => s.load);
  const regenerar = useAccesoStore((s) => s.regenerar);
  const revocar = useAccesoStore((s) => s.revocar);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccesoTemporal | null>(null);
  const [secreto, setSecreto] = useState<{ nombre: string; enlace?: string; codigo?: string } | null>(
    null,
  );
  const [regenerando, setRegenerando] = useState<AccesoTemporal | null>(null);
  const [regenerandoBusy, setRegenerandoBusy] = useState(false);
  const [revocando, setRevocando] = useState<AccesoTemporal | null>(null);
  const [revocandoBusy, setRevocandoBusy] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(acceso: AccesoTemporal) {
    setEditing(acceso);
    setFormOpen(true);
  }

  function handleCreated(resultado: AccesoCreadoResult) {
    setSecreto({ nombre: resultado.acceso.nombre, enlace: resultado.enlace, codigo: resultado.codigo });
  }

  async function handleRegenerar(opciones: { enlace: boolean; codigo: boolean }) {
    if (!regenerando) return;
    setRegenerandoBusy(true);
    try {
      const resultado = await regenerar(regenerando.id, opciones);
      setSecreto({ nombre: regenerando.nombre, enlace: resultado.enlace, codigo: resultado.codigo });
      setRegenerando(null);
    } finally {
      setRegenerandoBusy(false);
    }
  }

  async function handleRevocar() {
    if (!revocando) return;
    setRevocandoBusy(true);
    try {
      await revocar(revocando.id);
      setRevocando(null);
    } finally {
      setRevocandoBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Meseros"
        subtitle="Accesos temporales — enlace y código de 4 dígitos, sin usuario ni clave"
        actions={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Nuevo acceso
          </Button>
        }
      />

      <PageBody>
        {status === "loading" && accesos.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando accesos…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<Users size={26} />}
            title="No se pudieron cargar los accesos"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void load()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && accesos.length === 0 && (
          <EmptyState
            icon={<Users size={26} />}
            title="Todavía no hay accesos"
            description="Crea uno para que un mesero entre desde su teléfono con un enlace y un código, sin usuario ni clave."
            action={
              <Button variant="primary" onClick={openCreate}>
                <Plus size={14} /> Nuevo acceso
              </Button>
            }
          />
        )}

        {accesos.length > 0 && (
          <Section title="Accesos vivos" description={`${accesos.length} activos ahora mismo.`}>
            {/* Mobile: tarjetas apiladas, mismo patrón que ProductosPage. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {accesos.map((acceso) => (
                <li
                  key={acceso.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{acceso.nombre}</p>
                      <p className="text-[12px] text-fg-muted">
                        Vence {formatDateTime(acceso.accesoHasta)}
                      </p>
                    </div>
                    <AccionesAcceso
                      acceso={acceso}
                      onEditar={() => openEdit(acceso)}
                      onRegenerar={() => setRegenerando(acceso)}
                      onRevocar={() => setRevocando(acceso)}
                    />
                  </div>
                  <ModulosBadges modulos={acceso.modulos} />
                  {acceso.fallosConsecutivos >= UMBRAL_FALLOS_SOSPECHOSOS && (
                    <AvisoFallos acceso={acceso} onRegenerar={() => setRegenerando(acceso)} />
                  )}
                </li>
              ))}
            </ul>

            {/* Desktop: tabla. */}
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border bg-surface-sunken text-[11px] uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th className="px-5 py-3 font-medium">Nombre</th>
                      <th className="px-5 py-3 font-medium">Módulos</th>
                      <th className="px-5 py-3 font-medium">Vence</th>
                      <th className="px-5 py-3 font-medium">Último acceso</th>
                      <th className="px-5 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accesos.map((acceso) => (
                      <tr key={acceso.id} className="transition-colors duration-150 hover:bg-surface-hover">
                        <td className="px-5 py-3">
                          <span className="font-medium text-fg">{acceso.nombre}</span>
                          {acceso.fallosConsecutivos >= UMBRAL_FALLOS_SOSPECHOSOS && (
                            <div className="mt-1">
                              <AvisoFallos acceso={acceso} onRegenerar={() => setRegenerando(acceso)} />
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <ModulosBadges modulos={acceso.modulos} />
                        </td>
                        <td className="px-5 py-3 text-fg-muted">{formatDateTime(acceso.accesoHasta)}</td>
                        <td className="px-5 py-3 text-fg-muted">
                          {acceso.ultimoAccesoEn ? formatDateTime(acceso.ultimoAccesoEn) : "Nunca"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconButton
                              icon={<Pencil size={15} />}
                              label={`Editar acceso de ${acceso.nombre}`}
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(acceso)}
                            />
                            <IconButton
                              icon={<RotateCw size={15} />}
                              label={`Regenerar acceso de ${acceso.nombre}`}
                              variant="outline"
                              size="sm"
                              onClick={() => setRegenerando(acceso)}
                            />
                            <IconButton
                              icon={<Trash2 size={15} />}
                              label={`Revocar acceso de ${acceso.nombre}`}
                              variant="danger"
                              size="sm"
                              onClick={() => setRevocando(acceso)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}
      </PageBody>

      <AccesoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onCreated={handleCreated}
      />

      <SecretoAccesoModal
        open={secreto !== null}
        onClose={() => setSecreto(null)}
        nombre={secreto?.nombre ?? ""}
        enlace={secreto?.enlace}
        codigo={secreto?.codigo}
      />

      <RegenerarAccesoModal
        acceso={regenerando}
        onClose={() => setRegenerando(null)}
        onConfirm={handleRegenerar}
        busy={regenerandoBusy}
      />

      <ConfirmDialog
        open={revocando !== null}
        onClose={() => setRevocando(null)}
        onConfirm={() => void handleRevocar()}
        title={revocando ? `Revocar acceso de ${revocando.nombre}` : "Revocar acceso"}
        description="Deja de poder entrar de inmediato. No se puede deshacer — habría que crear un acceso nuevo."
        confirmLabel="Revocar"
        busy={revocandoBusy}
      />
    </div>
  );
}

function ModulosBadges({ modulos }: { modulos: ModuloApp[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {modulos.map((modulo) => (
        <Badge key={modulo} tone="neutral">
          {LABEL_POR_MODULO.get(modulo) ?? modulo}
        </Badge>
      ))}
    </div>
  );
}

function AvisoFallos({ acceso, onRegenerar }: { acceso: AccesoTemporal; onRegenerar: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-[12px] font-medium text-danger">
      <AlertTriangle size={13} className="shrink-0" />
      Alguien probó códigos en este acceso ({acceso.fallosConsecutivos} intentos fallidos seguidos).
      <button type="button" onClick={onRegenerar} className="underline underline-offset-2">
        Regenerar ahora
      </button>
    </div>
  );
}

function AccionesAcceso({
  acceso,
  onEditar,
  onRegenerar,
  onRevocar,
}: {
  acceso: AccesoTemporal;
  onEditar: () => void;
  onRegenerar: () => void;
  onRevocar: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={<MoreVertical size={16} />}
          label={`Más opciones de ${acceso.nombre}`}
          variant="outline"
          size="sm"
          tooltip={false}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditar}>
          <Pencil size={14} /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRegenerar}>
          <RotateCw size={14} /> Regenerar enlace/código
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRevocar}>
          <Trash2 size={14} /> Revocar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
