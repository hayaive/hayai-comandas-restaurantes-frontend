import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageBody, Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useRestauranteStore } from "@/lib/useRestauranteStore";
import { useTasaStore } from "@/lib/useTasaStore";
import { cn } from "@/lib/cn";
import { resolveMediaUrl } from "@/api/mediaUrl";
import { api, ApiError } from "@/api";
import type { MostrarPreciosEn } from "@/api";

const TIPOS_IMAGEN_ACEPTADOS = "image/jpeg,image/png,image/webp";
/** Límite del logo — decisión del dueño, distinto de los 5MB de las fotos de producto. */
const LOGO_MAX_BYTES = 1 * 1024 * 1024;
const NOMBRE_MAX = 60;

interface VistaOpcion {
  value: MostrarPreciosEn;
  label: string;
  description: string;
  ejemplo: string;
}

const VISTA_OPCIONES: VistaOpcion[] = [
  {
    value: "usd",
    label: "Sólo dólares",
    description: "Cada precio se muestra únicamente en USD, sin conversión.",
    ejemplo: "$12,00",
  },
  {
    value: "bs",
    label: "Sólo bolívares",
    description: "Cada precio se convierte a bolívares con la tasa del día.",
    ejemplo: "Bs 10.500,00",
  },
  {
    value: "ambas",
    label: "Dólares y bolívares",
    description: "El dólar con su equivalente en bolívares al lado. Es lo que la app muestra hoy.",
    ejemplo: "$12,00 · Bs 10.500,00",
  },
];

/** Iniciales del nombre del negocio, para el avatar de respaldo cuando no hay logo — nunca un `<img>` roto. */
function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  return palabras
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ConfiguracionPage() {
  const status = useRestauranteStore((s) => s.status);
  const restaurante = useRestauranteStore((s) => s.restaurante);
  const error = useRestauranteStore((s) => s.error);
  const guardando = useRestauranteStore((s) => s.guardando);
  const load = useRestauranteStore((s) => s.load);
  const update = useRestauranteStore((s) => s.update);
  const tasaUsdValor = useTasaStore((s) => s.vigente?.usd?.valor ?? null);

  const [nombre, setNombre] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [mostrarPreciosEn, setMostrarPreciosEn] = useState<MostrarPreciosEn>("ambas");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // El store ya se carga una vez en `AppShell` (`useRestauranteBootstrap`);
  // este `load()` sólo cubre el caso raro de un `status: "error"` previo
  // (p. ej. el primer intento falló por red) sin que el usuario tenga que
  // recargar toda la app — mismo patrón que `ProductosPage`.
  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  // Sincroniza el formulario con lo que llegó del servidor — sólo cuando
  // cambia el propio `restaurante` (no en cada tecla), para no pisar lo que
  // el usuario está escribiendo con la respuesta de un `load()` de fondo.
  useEffect(() => {
    if (!restaurante) return;
    setNombre(restaurante.nombre);
    setLogoUrl(restaurante.logoUrl);
    setMostrarPreciosEn(restaurante.mostrarPreciosEn);
  }, [restaurante]);

  function limpiarAvisoGuardado() {
    setGuardado(false);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Resetea el input para que elegir el mismo archivo dos veces seguidas
    // vuelva a disparar `onChange`.
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    limpiarAvisoGuardado();

    // §7 del diseño: el límite de 1MB se valida ANTES de subir — nunca se
    // llama al endpoint con un archivo que ya sabemos que va a rechazar.
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError(
        `El logo pesa ${(file.size / (1024 * 1024)).toFixed(1)}MB; el máximo son 1MB. Comprime la imagen e inténtalo de nuevo.`,
      );
      return;
    }

    setLogoUploading(true);
    try {
      const { url } = await api.uploadLogo(file);
      setLogoUrl(url);
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : "No se pudo subir el logo");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSubmit() {
    const trimmed = nombre.trim();
    if (!trimmed) {
      setFormError("El nombre del negocio es obligatorio");
      return;
    }
    if (trimmed.length > NOMBRE_MAX) {
      setFormError(`El nombre no puede superar los ${NOMBRE_MAX} caracteres`);
      return;
    }
    if (logoUploading) {
      setFormError("Espera a que termine de subirse el logo");
      return;
    }
    setFormError(null);
    try {
      await update({ nombre: trimmed, logoUrl, mostrarPreciosEn });
      setGuardado(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la configuración");
    }
  }

  if (status === "loading" && !restaurante) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader title="Configuración" subtitle="Nombre, logo y moneda de visualización" />
        <PageBody>
          <p className="py-10 text-center text-sm text-fg-muted">Cargando configuración…</p>
        </PageBody>
      </div>
    );
  }

  if (status === "error" && !restaurante) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader title="Configuración" subtitle="Nombre, logo y moneda de visualización" />
        <PageBody>
          <EmptyState
            icon={<Settings2 size={26} />}
            title="No se pudo cargar la configuración"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void load()}>Reintentar</Button>}
          />
        </PageBody>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Configuración" subtitle="Nombre, logo y moneda de visualización del negocio" />

      <PageBody>
        <Section title="Datos del negocio" description="Se usan en la app, el ticket impreso y la tarjeta de WhatsApp de reservas.">
          <Card>
            <CardBody className="flex flex-col gap-5">
              <Input
                label="Nombre del negocio"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  limpiarAvisoGuardado();
                }}
                maxLength={NOMBRE_MAX}
                hint={`${nombre.length}/${NOMBRE_MAX} caracteres. Aparece en el ticket, la tarjeta de reservas y el título de las notificaciones.`}
                placeholder="Ej. Coffee & Cake"
              />

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-fg">Logo</span>
                <div className="flex items-center gap-3">
                  <LogoPreview url={logoUrl} nombre={nombre} uploading={logoUploading} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={logoUploading}
                      >
                        {logoUploading ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Elegir logo"}
                      </Button>
                      {logoUrl && !logoUploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogoUrl(null);
                            limpiarAvisoGuardado();
                          }}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={TIPOS_IMAGEN_ACEPTADOS}
                      className="hidden"
                      onChange={(e) => void handleFileSelected(e)}
                    />
                    <p className="text-[12px] text-fg-subtle">
                      JPG, PNG o WEBP, hasta 1MB. Sin logo, se usan las iniciales del nombre.
                    </p>
                    {logoError && <p className="text-[12px] text-danger">{logoError}</p>}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section
          title="Moneda de visualización"
          description="En qué moneda se dibujan los precios en la app, el ticket y la tarjeta de WhatsApp. Es sólo presentación: no cambia cómo se cobra."
        >
          <div role="radiogroup" aria-label="Moneda de visualización" className="grid gap-3 sm:grid-cols-3">
            {VISTA_OPCIONES.map((opcion) => (
              <button
                key={opcion.value}
                type="button"
                role="radio"
                aria-checked={mostrarPreciosEn === opcion.value}
                onClick={() => {
                  setMostrarPreciosEn(opcion.value);
                  limpiarAvisoGuardado();
                }}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-[var(--radius-lg)] border p-4 text-left",
                  "transition-colors duration-150",
                  mostrarPreciosEn === opcion.value
                    ? "border-active bg-active/10"
                    : "border-border bg-surface-raised hover:border-border-strong hover:bg-surface-hover",
                )}
              >
                <span className="text-[13px] font-semibold text-fg">{opcion.label}</span>
                <span className="text-[12px] leading-relaxed text-fg-muted">{opcion.description}</span>
                <span className="font-mono text-[12px] tabular-nums text-fg-subtle">{opcion.ejemplo}</span>
              </button>
            ))}
          </div>

          {mostrarPreciosEn === "bs" && !tasaUsdValor && (
            <p className="text-[12px] leading-relaxed text-fg-subtle">
              Todavía no hay una tasa de cambio registrada. Mientras tanto, los precios se seguirán
              mostrando en dólares en toda la app — en cuanto se registre una tasa, esta vista pasa a
              mostrarlos en bolívares automáticamente.
            </p>
          )}
        </Section>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Guardar cambios</CardTitle>
              <CardDescription>Se aplican de inmediato en este dispositivo; el resto se actualiza al recargar.</CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="justify-between">
            <div className="flex-1">
              {formError && <p className="text-[12px] text-danger">{formError}</p>}
              {!formError && guardado && (
                <p className="text-[12px] text-status-free-fg">Configuración guardada.</p>
              )}
            </div>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={guardando || logoUploading}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </CardFooter>
        </Card>
      </PageBody>
    </div>
  );
}

function LogoPreview({
  url,
  nombre,
  uploading,
}: {
  url: string | null;
  nombre: string;
  uploading: boolean;
}) {
  return (
    <div
      className={cn(
        "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-hover text-lg font-semibold text-fg-muted",
        uploading && "animate-pulse",
      )}
    >
      {url ? (
        <img src={resolveMediaUrl(url)} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{inicialesDe(nombre)}</span>
      )}
    </div>
  );
}
