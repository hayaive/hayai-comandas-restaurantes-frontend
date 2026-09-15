import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { PageBody, Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductThumbnail } from "@/components/productos/ProductThumbnail";
import { useActiveTemplate, useFloorPlanStore } from "@/lib/useFloorPlanStore";
import { useActiveProducts, useProductStore } from "@/lib/useProductStore";
import { useComandaStore } from "@/lib/useComandaStore";
import { STATUS_META } from "@/components/floor-plan/statusMeta";
import { DualPrice } from "@/components/shared/DualPrice";
import { cn } from "@/lib/cn";
import type { RestaurantTable } from "@/lib/types";
import type { Producto } from "@/api";

/**
 * Fast order-taking screen for waitstaff — pick a table, tap products, send
 * to the kitchen/bar via the comanda for that table. Simpler than the full
 * Comandas panel (which is for managing/serving already-open comandas):
 * this one only creates/feeds a comanda and hands off to it.
 *
 * The three steps are numbered in the card headers because a new waiter runs
 * this screen under pressure on their first shift, and the order matters —
 * you cannot add a product before you have a table.
 *
 * SELECTED TABLE: brown fill, white text. This is the clearest place in the
 * product where the client's override earns its keep — a waiter glancing down
 * mid-service sees which table they are ordering for without reading.
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
  const productStatus = useProductStore((s) => s.status);
  const loadProductos = useProductStore((s) => s.load);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [productQuery, setProductQuery] = useState("");

  useEffect(() => {
    if (productStatus === "idle") void loadProductos();
  }, [productStatus, loadProductos]);

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

  /**
   * Buscador, no lista completa: no debe verse ningún producto hasta que el
   * usuario empiece a escribir. Filtro simple por nombre, client-side —
   * `disponibles` ya está en memoria vía `useActiveProducts()`.
   */
  const filteredProductos = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return disponibles
      .filter((p) => p.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [disponibles, productQuery]);

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
    setProductQuery("");
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

  /**
   * Enviar el pedido es UNA sola llamada: la comanda nace con sus líneas y ya
   * encolada en despacho. Antes esto eran N+1 llamadas (abrir la comanda de la
   * mesa y después empujarle los ítems uno a uno), y encima asumía que la mesa
   * tenía como mucho una comanda. Hoy cada envío es una comanda nueva, así que
   * mandar dos rondas a la misma mesa es lo normal y no un conflicto.
   */
  async function handleSubmit() {
    if (!selectedTableId || cart.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const floorState = useFloorPlanStore.getState();
      const template = floorState.templates.find((t) => t.id === floorState.activeTemplateId);
      const table = template?.tables.find((t) => t.id === selectedTableId);
      if (!table) throw new Error("La mesa seleccionada ya no existe");

      await useComandaStore.getState().crearComanda({
        tipo: "mesa",
        mesaId: table.id,
        mesaEtiqueta: table.label,
        comensales: table.seats,
        items: cart.map((line) => ({ productoId: line.productoId, cantidad: line.cantidad })),
      });

      // La ocupación la confirma `refreshPlano()` desde el store; esto sólo
      // adelanta el color de la mesa para que el mesero no espere el round-trip.
      if (table.status === "free") {
        useFloorPlanStore.getState().setStatus(table.id, "occupied", clienteNombre.trim() || undefined);
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
      <PageHeader
        title="Mesero"
        subtitle="Toma el pedido y envíalo directo a la comanda de la mesa"
      />

      <PageBody>
        <Section>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>1. Elige una mesa</CardTitle>
                  {selectedTable && <Badge tone="active">Mesa {selectedTable.label}</Badge>}
                </CardHeader>
                <CardBody>
                  {sortedTables.length === 0 ? (
                    <p className="py-8 text-center text-sm text-fg-muted">
                      {floorStatus === "loading" || floorStatus === "idle"
                        ? "Cargando el plano…"
                        : floorStatus === "error"
                          ? (floorError ?? "No se pudo cargar el plano del salón.")
                          : "No hay mesas en esta plantilla."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                      {sortedTables.map((table) => {
                        const meta = STATUS_META[table.status];
                        const isSelected = table.id === selectedTableId;
                        return (
                          <button
                            key={table.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => selectTable(table)}
                            className={cn(
                              "flex flex-col items-start gap-1 rounded-[var(--radius-md)] border px-3.5 py-3 text-left",
                              "transition-colors duration-150",
                              isSelected
                                ? "border-transparent bg-active"
                                : "border-border bg-surface-raised hover:border-border-strong hover:bg-surface-hover",
                            )}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "font-mono text-sm font-semibold tabular-nums",
                                  isSelected ? "text-active-fg" : "text-fg",
                                )}
                              >
                                {table.label}
                              </span>
                              <span
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  isSelected ? "bg-white/80" : meta.dotClass,
                                )}
                              />
                            </div>
                            <span
                              className={cn(
                                "w-full truncate text-[11px]",
                                isSelected ? "text-active-fg/80" : "text-fg-subtle",
                              )}
                            >
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
                  <CardTitle>2. Agrega productos</CardTitle>
                  {filteredProductos.length > 0 && (
                    <span className="font-mono text-[12px] tabular-nums text-fg-subtle">
                      {filteredProductos.length} resultados
                    </span>
                  )}
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  {!selectedTable && (
                    <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
                      Elige una mesa para empezar a agregar productos.
                    </p>
                  )}
                  {selectedTable && (
                    <>
                      <Input
                        label="Buscar producto"
                        placeholder="Ej. Tequeños"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                      />
                      {productStatus === "loading" && productos.length === 0 && (
                        <p className="py-8 text-center text-sm text-fg-muted">Cargando catálogo…</p>
                      )}
                      {productStatus === "ready" && productQuery.trim() === "" && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                          <IconTile tone="neutral" size="lg">
                            <Search size={22} />
                          </IconTile>
                          <p className="text-sm text-fg-subtle">Escribe para buscar un producto.</p>
                        </div>
                      )}
                      {productStatus === "ready" &&
                        productQuery.trim() !== "" &&
                        filteredProductos.length === 0 && (
                          <p className="py-8 text-center text-sm text-fg-muted">
                            No se encontraron productos con ese nombre.
                          </p>
                        )}
                      {filteredProductos.length > 0 && (
                        <ul className="flex max-h-[380px] flex-col gap-1.5 overflow-y-auto">
                          {filteredProductos.map((producto) => (
                            <li key={producto.id}>
                              <button
                                type="button"
                                onClick={() => addToCart(producto)}
                                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-hover"
                              >
                                <ProductThumbnail imagenUrl={producto.imagenUrl} alt={producto.nombre} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-sm font-medium text-fg">
                                    {producto.nombre}
                                  </span>
                                  <DualPrice
                                    usd={producto.precio}
                                    className="font-mono text-[12px] tabular-nums text-fg-muted"
                                  />
                                </span>
                                <Badge tone="accent" className="shrink-0">
                                  <Plus size={12} />
                                  Agregar
                                </Badge>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* La columna del pedido se pega arriba en desktop: el mesero
                agrega productos con el pulgar mientras el total queda a la
                vista sin hacer scroll de vuelta. */}
            <div className="flex flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>3. Pedido</CardTitle>
                  {selectedTable && (
                    <span className="font-mono text-[12px] tabular-nums text-fg-subtle">
                      {selectedTable.label}
                    </span>
                  )}
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  {cart.length === 0 ? (
                    <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-6 text-center text-sm text-fg-subtle">
                      Todavía no agregaste productos
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border">
                      {cart.map((line) => (
                        <li key={line.productoId} className="flex items-center gap-2 py-2.5">
                          <ProductThumbnail imagenUrl={line.imagenUrl} alt={line.nombre} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">{line.nombre}</p>
                            <DualPrice
                              usd={Number(line.precio) * line.cantidad}
                              className="font-mono text-[11px] tabular-nums text-fg-subtle"
                            />
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <IconButton
                              icon={<Minus size={13} />}
                              label={`Quitar una unidad de ${line.nombre}`}
                              size="sm"
                              onClick={() => changeQuantity(line.productoId, -1)}
                            />
                            <span className="w-6 text-center font-mono text-sm tabular-nums font-semibold text-fg">
                              {line.cantidad}
                            </span>
                            <IconButton
                              icon={<Plus size={13} />}
                              label={`Agregar una unidad de ${line.nombre}`}
                              size="sm"
                              onClick={() => changeQuantity(line.productoId, 1)}
                            />
                          </div>
                          <IconButton
                            icon={<Trash2 size={13} />}
                            label={`Quitar ${line.nombre} del pedido`}
                            variant="danger"
                            size="sm"
                            onClick={() => removeLine(line.productoId)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <span className="text-sm font-medium text-fg-muted">Total</span>
                    <DualPrice
                      usd={cartTotal}
                      className="font-mono text-lg font-semibold tabular-nums text-fg"
                    />
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
                      role="status"
                      className={cn(
                        "flex items-start gap-2 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm",
                        feedback.type === "success"
                          ? "border-status-free/40 bg-status-free-soft text-status-free-fg"
                          : "border-danger/30 bg-danger-soft text-danger",
                      )}
                    >
                      {feedback.type === "success" ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      )}
                      {feedback.message}
                    </div>
                  )}

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => void handleSubmit()}
                    disabled={!selectedTableId || cart.length === 0 || submitting}
                  >
                    <Receipt size={16} /> {submitting ? "Enviando…" : "Enviar a comanda"}
                  </Button>
                </CardBody>
              </Card>
            </div>
          </div>
        </Section>
      </PageBody>
    </div>
  );
}
