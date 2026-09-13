import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Minus, Plus, Receipt, Trash, Warning } from "@phosphor-icons/react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ProductThumbnail } from "@/components/productos/ProductThumbnail";
import { useActiveTemplate, useFloorPlanStore } from "@/lib/useFloorPlanStore";
import { useActiveProducts, useProductStore } from "@/lib/useProductStore";
import { useComandaStore } from "@/lib/useComandaStore";
import { STATUS_META } from "@/components/floor-plan/statusMeta";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RestaurantTable } from "@/lib/types";
import type { Producto } from "@/api";

/**
 * Fast order-taking screen for waitstaff — pick a table, tap products, send
 * to the kitchen/bar via the comanda for that table. Simpler than the full
 * Comandas panel (which is for managing/serving already-open comandas):
 * this one only creates/feeds a comanda and hands off to it.
 */

interface CartLine {
  productoId: string;
  nombre: string;
  precio: string;
  cantidad: number;
  imagenUrl?: string;
}

const TABLE_ORDER: Record<RestaurantTable["status"], number> = { free: 0, occupied: 1, reserved: 2 };

export function MeseroPage() {
  const activeTemplate = useActiveTemplate();
  const floorStatus = useFloorPlanStore((s) => s.status);
  const floorError = useFloorPlanStore((s) => s.error);
  const productos = useActiveProducts();
  const categorias = useProductStore((s) => s.categorias);
  const productStatus = useProductStore((s) => s.status);
  const loadProductos = useProductStore((s) => s.load);
  const loadComandas = useComandaStore((s) => s.load);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (productStatus === "idle") void loadProductos();
  }, [productStatus, loadProductos]);

  useEffect(() => {
    void loadComandas();
  }, [loadComandas]);

  const sortedTables = useMemo(
    () =>
      [...activeTemplate.tables].sort(
        (a, b) =>
          TABLE_ORDER[a.status] - TABLE_ORDER[b.status] ||
          a.label.localeCompare(b.label, undefined, { numeric: true }),
      ),
    [activeTemplate.tables],
  );

  const disponibles = useMemo(() => productos.filter((p) => p.disponible), [productos]);

  const byCategory = useMemo(
    () =>
      categorias
        .map((categoria) => ({
          categoria,
          productos: disponibles.filter((p) => p.categoriaId === categoria.id),
        }))
        .filter((group) => group.productos.length > 0),
    [categorias, disponibles],
  );

  const selectedTable = selectedTableId
    ? (activeTemplate.tables.find((t) => t.id === selectedTableId) ?? null)
    : null;
  const showClienteInput = Boolean(selectedTable && !selectedTable.occupantName);
  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.precio) * line.cantidad, 0),
    [cart],
  );

  function selectTable(table: RestaurantTable) {
    setSelectedTableId(table.id);
    setFeedback(null);
  }

  function addToCart(producto: Producto) {
    setFeedback(null);
    setCart((prev) => {
      const idx = prev.findIndex((line) => line.productoId === producto.id);
      if (idx === -1) {
        return [
          ...prev,
          {
            productoId: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            imagenUrl: producto.imagenUrl,
          },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 };
      return next;
    });
  }

  function changeQuantity(productoId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.productoId === productoId ? { ...line, cantidad: line.cantidad + delta } : line))
        .filter((line) => line.cantidad > 0),
    );
  }

  function removeLine(productoId: string) {
    setCart((prev) => prev.filter((line) => line.productoId !== productoId));
  }

  async function handleSubmit() {
    if (!selectedTableId || cart.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const floorState = useFloorPlanStore.getState();
      const template = floorState.templates.find((t) => t.id === floorState.activeTemplateId);
      const table = template?.tables.find((t) => t.id === selectedTableId);
      if (!table) throw new Error("La mesa seleccionada ya no existe");

      const clienteFinal = !table.occupantName && clienteNombre.trim() ? clienteNombre.trim() : undefined;

      await useComandaStore.getState().ensureComandaForTable(table.id, table.label, clienteFinal);

      const comanda = useComandaStore.getState().comandas.find((c) => c.mesaId === table.id);
      if (!comanda) {
        throw new Error(useComandaStore.getState().error ?? "No se pudo abrir la comanda de la mesa");
      }

      if (table.status === "free") {
        useFloorPlanStore.getState().setStatus(table.id, "occupied", clienteFinal);
      }

      for (const line of cart) {
        await useComandaStore.getState().addItem(comanda.id, line.productoId, line.cantidad);
      }

      setFeedback({
        type: "success",
        message: `Pedido enviado a ${table.label} — ${cart.length} producto${cart.length === 1 ? "" : "s"}.`,
      });
      setCart([]);
      setClienteNombre("");
      setSelectedTableId(null);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo enviar el pedido",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-[16px] font-semibold text-fg">Mesero</h1>
        <p className="text-[12px] text-fg-muted">Toma el pedido y envíalo directo a la comanda de la mesa</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <span className="text-[13px] font-semibold text-fg">1. Elige una mesa</span>
                <span className="text-[12px] text-fg-subtle">{activeTemplate.name}</span>
              </CardHeader>
              <CardBody>
                {sortedTables.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-fg-muted">
                    {floorStatus === "loading" || floorStatus === "idle"
                      ? "Cargando el plano…"
                      : floorStatus === "error"
                        ? (floorError ?? "No se pudo cargar el plano del salón.")
                        : "No hay mesas en esta plantilla."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {sortedTables.map((table) => {
                      const meta = STATUS_META[table.status];
                      const isSelected = table.id === selectedTableId;
                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => selectTable(table)}
                          className={cn(
                            "flex flex-col items-start gap-1 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors duration-150",
                            isSelected
                              ? "border-accent bg-accent-soft"
                              : "border-border bg-surface-raised hover:bg-surface-hover",
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="font-mono text-[13px] font-semibold text-fg">{table.label}</span>
                            <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
                          </div>
                          <span className="truncate text-[11px] text-fg-subtle">
                            {meta.label}
                            {table.occupantName ? ` · ${table.occupantName}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <span className="text-[13px] font-semibold text-fg">2. Agrega productos</span>
                {selectedTable && <Badge tone="accent">Mesa {selectedTable.label}</Badge>}
              </CardHeader>
              <CardBody>
                {!selectedTable && (
                  <p className="py-6 text-center text-[13px] text-fg-muted">
                    Elige una mesa para empezar a agregar productos.
                  </p>
                )}
                {selectedTable && productStatus === "loading" && productos.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-fg-muted">Cargando catálogo…</p>
                )}
                {selectedTable && productStatus === "ready" && byCategory.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-fg-muted">No hay productos disponibles.</p>
                )}
                {selectedTable && byCategory.length > 0 && (
                  <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto">
                    {byCategory.map(({ categoria, productos: items }) => (
                      <div key={categoria.id}>
                        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                          {categoria.nombre}
                        </h3>
                        <ul className="flex flex-col gap-1">
                          {items.map((producto) => (
                            <li key={producto.id}>
                              <button
                                type="button"
                                onClick={() => addToCart(producto)}
                                className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-hover"
                              >
                                <ProductThumbnail imagenUrl={producto.imagenUrl} alt={producto.nombre} />
                                <span className="flex flex-1 flex-col">
                                  <span className="text-[13px] font-medium text-fg">{producto.nombre}</span>
                                  <span className="font-mono text-[12px] text-fg-muted">
                                    {formatUsd(producto.precio)}
                                  </span>
                                </span>
                                <Badge tone="accent" className="shrink-0">
                                  <Plus size={12} weight="bold" />
                                  Agregar
                                </Badge>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <span className="text-[13px] font-semibold text-fg">Pedido</span>
                {selectedTable && (
                  <span className="font-mono text-[12px] text-fg-subtle">{selectedTable.label}</span>
                )}
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                {cart.length === 0 ? (
                  <p className="rounded-[var(--radius-sm)] border border-dashed border-border px-3 py-4 text-center text-[13px] text-fg-subtle">
                    Todavía no agregaste productos
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {cart.map((line) => (
                      <li key={line.productoId} className="flex items-center gap-2 py-2">
                        <ProductThumbnail imagenUrl={line.imagenUrl} alt={line.nombre} />
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-fg">{line.nombre}</p>
                          <p className="font-mono text-[11px] text-fg-subtle">
                            {formatUsd(Number(line.precio) * line.cantidad)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            icon={<Minus size={12} />}
                            label={`Quitar una unidad de ${line.nombre}`}
                            size="sm"
                            onClick={() => changeQuantity(line.productoId, -1)}
                          />
                          <span className="w-5 text-center font-mono text-[13px] text-fg">{line.cantidad}</span>
                          <IconButton
                            icon={<Plus size={12} />}
                            label={`Agregar una unidad de ${line.nombre}`}
                            size="sm"
                            onClick={() => changeQuantity(line.productoId, 1)}
                          />
                        </div>
                        <IconButton
                          icon={<Trash size={13} />}
                          label={`Quitar ${line.nombre} del pedido`}
                          variant="danger"
                          size="sm"
                          onClick={() => removeLine(line.productoId)}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[13px] font-medium text-fg-muted">Total</span>
                  <span className="font-mono text-[16px] font-semibold text-fg">{formatUsd(cartTotal)}</span>
                </div>

                {showClienteInput && (
                  <Input
                    label="Nombre del cliente (opcional)"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Ej. Familia Restrepo"
                  />
                )}

                {feedback && (
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13px]",
                      feedback.type === "success"
                        ? "border-status-free bg-status-free-soft text-status-free-fg"
                        : "border-danger/30 bg-danger-soft text-danger",
                    )}
                  >
                    {feedback.type === "success" ? (
                      <CheckCircle size={16} className="mt-0.5 shrink-0" weight="fill" />
                    ) : (
                      <Warning size={16} className="mt-0.5 shrink-0" />
                    )}
                    {feedback.message}
                  </div>
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => void handleSubmit()}
                  disabled={!selectedTableId || cart.length === 0 || submitting}
                >
                  <Receipt size={14} /> {submitting ? "Enviando…" : "Enviar a comanda"}
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
