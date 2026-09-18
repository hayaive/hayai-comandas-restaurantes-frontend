import { useEffect, useRef } from "react";
import { create } from "zustand";

import { consumirComandaPropia, useComandaStore } from "./useComandaStore";

/**
 * Alerta de la cola de despacho: cuando entra una comanda nueva suena una
 * alarma de 3 segundos, vibra el dispositivo y sale una notificación del
 * sistema, para que nadie tenga que estar mirando el monitor.
 *
 * **Vive a nivel de app, no de pantalla.** Antes esto era un hook con estado
 * local que montaba `ComandasPage`: al salir de esa pantalla el componente se
 * desmontaba y no quedaba nadie escuchando, así que el cocinero que estaba en
 * Mesas o en Cuentas no se enteraba de nada. Ahora el estado vive en un store
 * y la detección corre en `useAlertaCocinaBootstrap`, montado una sola vez en
 * `AppShell`. `ComandasPage` sólo pinta los controles, que actúan sobre esa
 * misma instancia.
 *
 * El `AudioContext` y los osciladores son singletons de módulo por la misma
 * razón: uno solo para toda la vida de la app, en vez de uno por montaje.
 *
 * Los tres canales son deliberadamente redundantes porque cada uno falla en un
 * escenario distinto: el audio no existe si el navegador aún no tuvo un gesto
 * del usuario, la vibración no existe en iOS, y la notificación necesita un
 * permiso que pueden denegar. Ninguno depende de los otros.
 *
 * LÍMITE IMPORTANTE: la notificación NO es Web Push. Avisa mientras la app
 * sigue viva —aunque esté en segundo plano o con la pantalla apagada—, pero
 * con la app cerrada del todo no llega nada. Para eso hace falta suscripción
 * push con claves VAPID y endpoints en el backend que guarden la suscripción
 * y disparen el envío al crear la comanda.
 *
 * **Por qué se sintetiza en vez de usar un archivo.** No hay ningún asset de
 * audio en `public/` (sólo imágenes: favicon, logo, logo-mono), y agregar un
 * binario que no se puede escuchar ni verificar sería meter al repo un archivo
 * a ciegas. La Web Audio API genera la alarma sin dependencias, sin peso y sin
 * red — y si algún día el dueño trae su propio sonido, el punto de cambio es
 * sólo `reproducir()`.
 *
 * **Autoplay.** Los navegadores no dejan sonar nada hasta que el usuario haya
 * interactuado con la página: un `AudioContext` creado antes nace `suspended`.
 * Por eso el contexto se crea perezosamente, se intenta `resume()` en el primer
 * gesto real del usuario, y todo va envuelto en try/catch — `resume()` devuelve
 * una promesa que se RECHAZA si el gesto todavía no ocurrió, y un rechazo sin
 * capturar ensuciaría la consola en cada comanda nueva.
 */

/**
 * Alarma de 3 segundos, no un bip.
 *
 * El bip corto original se perdía entre campanas, extractor y platos: para
 * cuando alguien levantaba la cabeza ya había terminado. Esto es un patrón de
 * alerta —dos tonos alternados, pulso corto y hueco corto, repetidos hasta
 * completar 3s— que es lo que el oído lee como "atiéndeme ahora" y no como
 * notificación de fondo. La alternancia importa: un tono sostenido se vuelve
 * ruido de ambiente en segundos, uno que salta no.
 */
const DURACION_ALERTA_S = 3;
const PULSO_S = 0.22;
const SILENCIO_S = 0.08;
const FRECUENCIAS = [880, 1320];

interface Tono {
  frecuencia: number;
  inicio: number;
  duracion: number;
}

/** Los pulsos que cubren `DURACION_ALERTA_S`, alternando las dos frecuencias. */
function construirTonos(): Tono[] {
  const tonos: Tono[] = [];
  const ciclo = PULSO_S + SILENCIO_S;
  const total = Math.floor(DURACION_ALERTA_S / ciclo);
  for (let i = 0; i < total; i += 1) {
    tonos.push({
      frecuencia: FRECUENCIAS[i % FRECUENCIAS.length],
      inicio: i * ciclo,
      duracion: PULSO_S,
    });
  }
  return tonos;
}

const TONOS = construirTonos();

/**
 * Vibración con la misma cadencia que el audio: en una cocina el teléfono
 * suele estar en el bolsillo o boca abajo sobre la mesa de pase, donde se
 * siente antes de lo que se oye.
 *
 * `navigator.vibrate` NO existe en iOS/Safari (ni instalado como PWA): ahí
 * simplemente no vibra y el audio sigue haciendo su trabajo.
 */
const PATRON_VIBRACION = TONOS.flatMap(() => [PULSO_S * 1000, SILENCIO_S * 1000]);

type ContextoConWebkit = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

/** Lo que se anuncia en la notificación. Sin esto sólo suena y vibra. */
export interface DetalleAlerta {
  titulo: string;
  cuerpo: string;
  /** Agrupa notificaciones de la misma comanda para no apilar duplicados. */
  tag?: string;
}

export type PermisoNotificacion = "default" | "granted" | "denied" | "no-soportado";

// --- Singletons de audio -------------------------------------------------
// Fuera del store a propósito: son recursos del navegador, no estado que la UI
// deba re-renderizar. El store sólo guarda lo que se pinta.

let contexto: AudioContext | null = null;
let osciladores: OscillatorNode[] = [];
let finTimer: ReturnType<typeof setTimeout> | null = null;

function obtenerContexto(): AudioContext | null {
  if (contexto) return contexto;
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as ContextoConWebkit).webkitAudioContext;
  if (!Ctor) return null;
  try {
    contexto = new Ctor();
  } catch {
    // Safari en modo restringido, o un entorno sin salida de audio.
    contexto = null;
  }
  return contexto;
}

function leerPermiso(): PermisoNotificacion {
  if (typeof Notification === "undefined") return "no-soportado";
  return Notification.permission;
}

/**
 * Notificación del sistema. Se emite por el service worker cuando lo hay
 * (`registration.showNotification`) y no con `new Notification()`, porque es
 * la única vía que sigue mostrándose con la pestaña en segundo plano o la
 * pantalla apagada — que es justo el caso del teléfono en el bolsillo del
 * cocinero. `new Notification()` queda de respaldo para el navegador sin SW.
 */
async function notificar(detalle: DetalleAlerta): Promise<void> {
  if (leerPermiso() !== "granted") return;
  const opciones: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: detalle.cuerpo,
    icon: "/logo.jpg",
    badge: "/logo-mono.png",
    tag: detalle.tag,
    // Sin esto, en Android la notificación se va sola en pocos segundos y el
    // cocinero que estaba de espaldas no se entera de que llegó.
    requireInteraction: true,
    // La notificación pide su PROPIA vibración, además del `navigator.vibrate`
    // de `reproducir()`: con la pantalla apagada o la app en segundo plano,
    // Chrome bloquea `navigator.vibrate` en una página oculta, y justo ése es
    // el caso del teléfono en el bolsillo. Sin esto no vibraba nada.
    vibrate: PATRON_VIBRACION,
    silent: false,
    // Varios pedidos a la vez comparten la etiqueta "cola-despacho": sin
    // `renotify`, el segundo lote REEMPLAZABA al primero en silencio, sin
    // vibrar. `renotify` sin etiqueta hace lanzar a `showNotification`, así
    // que sólo se pide cuando hay una.
    ...(detalle.tag ? { renotify: true } : {}),
  };
  try {
    const registro = await navigator.serviceWorker?.ready;
    if (registro) {
      await registro.showNotification(detalle.titulo, opciones);
      return;
    }
    new Notification(detalle.titulo, opciones);
  } catch {
    /* La notificación es un extra: nunca puede romper la cola de despacho. */
  }
}

function vibrar(patron: number | number[]): void {
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* Algunos navegadores lanzan si el patrón excede su límite. */
  }
}

// --- Store ---------------------------------------------------------------

interface AlertaCocinaState {
  activa: boolean;
  /** `true` mientras los 3 segundos siguen sonando. */
  sonando: boolean;
  /**
   * `true` cuando el navegador todavía no dejó sonar nada porque falta un
   * gesto del usuario. La UI lo usa para avisar en vez de mentir con un icono
   * de "sonido activo" que no suena.
   */
  bloqueadaPorNavegador: boolean;
  permisoNotificaciones: PermisoNotificacion;

  /** Dispara la alarma. No lanza nunca: si algo está bloqueado, no suena. */
  reproducir: (detalle?: DetalleAlerta) => void;
  /** Corta la alarma en curso — para el botón de "ya voy" de la cocina. */
  detener: () => void;
  alternar: () => void;
  /**
   * Pide el permiso de notificaciones. DEBE llamarse desde un gesto real del
   * usuario: los navegadores ignoran (o penalizan) la petición automática.
   */
  pedirPermisoNotificaciones: () => void;
  /** Intenta sacar el `AudioContext` de `suspended`. Se llama en cada gesto. */
  desbloquear: () => void;
}

export const useAlertaCocinaStore = create<AlertaCocinaState>((set, get) => ({
  activa: true,
  sonando: false,
  bloqueadaPorNavegador: false,
  permisoNotificaciones: leerPermiso(),

  detener: () => {
    for (const osc of osciladores) {
      try {
        osc.stop();
      } catch {
        /* Ya había terminado solo. */
      }
    }
    osciladores = [];
    if (finTimer) {
      clearTimeout(finTimer);
      finTimer = null;
    }
    // `vibrate(0)` es la forma de cancelar un patrón en curso.
    vibrar(0);
    set({ sonando: false });
  },

  reproducir: (detalle) => {
    if (!get().activa) return;

    // Vibración y notificación NO dependen del AudioContext: si el navegador
    // tiene el audio bloqueado por falta de gesto, el teléfono igual avisa.
    vibrar(PATRON_VIBRACION);
    if (detalle) void notificar(detalle);

    const ctx = obtenerContexto();
    if (!ctx) return;

    const emitir = () => {
      try {
        // Una alarma nueva reemplaza a la que sigue sonando en vez de
        // superponerse: dos patrones a destiempo suenan a ruido, no a alerta.
        get().detener();
        const ahora = ctx.currentTime;
        for (const tono of TONOS) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = tono.frecuencia;
          // Rampa de entrada y salida: un gain que salta de 0 a 1 de golpe
          // produce un "click" audible al principio y al final del tono.
          const inicio = ahora + tono.inicio;
          const fin = inicio + tono.duracion;
          gain.gain.setValueAtTime(0.0001, inicio);
          gain.gain.exponentialRampToValueAtTime(0.22, inicio + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, fin);
          osc.connect(gain).connect(ctx.destination);
          osc.start(inicio);
          osc.stop(fin + 0.02);
          osciladores.push(osc);
        }
        finTimer = setTimeout(() => {
          osciladores = [];
          finTimer = null;
          set({ sonando: false });
        }, DURACION_ALERTA_S * 1000);
        set({ sonando: true, bloqueadaPorNavegador: false });
      } catch {
        /* Nada que hacer: el sonido es un extra, no puede romper la pantalla. */
      }
    };

    if (ctx.state === "suspended") {
      // Puede rechazarse si el usuario todavía no interactuó: se marca como
      // bloqueada y se sigue, en vez de propagar un rechazo sin capturar.
      ctx
        .resume()
        .then(emitir)
        .catch(() => set({ bloqueadaPorNavegador: true }));
      return;
    }
    emitir();
  },

  alternar: () => {
    const siguiente = !get().activa;
    set({ activa: siguiente });
    // Encender el sonido ES un gesto del usuario: aprovéchalo para
    // desbloquear el contexto en el mismo toque.
    if (siguiente) get().desbloquear();
  },

  pedirPermisoNotificaciones: () => {
    if (typeof Notification === "undefined") {
      set({ permisoNotificaciones: "no-soportado" });
      return;
    }
    Notification.requestPermission()
      .then((permiso) => set({ permisoNotificaciones: permiso }))
      .catch(() => {
        /* El usuario cerró el diálogo: el permiso sigue como estaba. */
      });
  },

  desbloquear: () => {
    const ctx = obtenerContexto();
    if (!ctx) return;
    ctx
      .resume()
      .then(() => set({ bloqueadaPorNavegador: false }))
      .catch(() => {
        /* Sigue bloqueado; se reintenta en el próximo gesto. */
      });
  },
}));

/** Los controles que pinta `ComandasPage`. Leen y actúan sobre el store único. */
export function useAlertaCocina() {
  return useAlertaCocinaStore();
}

/**
 * Detecta comandas nuevas y dispara la alerta. Se monta UNA sola vez, en
 * `AppShell`, para que suene desde cualquier pantalla.
 *
 * OJO con la latencia: `useComandaBootstrap` refresca la cola cada 25s, así
 * que fuera de la pantalla de despacho el aviso puede llegar con ese retraso.
 * Estando en Despacho, su propio poll de 6s manda y es prácticamente
 * inmediato. Bajar el intervalo global sería más red desde cada dispositivo
 * del local a cambio de segundos que la cocina no nota.
 */
export function useAlertaCocinaBootstrap(): void {
  const cola = useComandaStore((s) => s.cola);
  const status = useComandaStore((s) => s.colaStatus);

  /**
   * `null` como valor inicial distingue "todavía no cargué nada" de "la cola
   * está vacía": sin esa distinción, la primera carga con pedidos ya en cola
   * dispararía la alarma al abrir la app.
   */
  const idsConocidos = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    const actuales = new Set(cola.map((c) => c.comandaId));
    const previos = idsConocidos.current;
    idsConocidos.current = actuales;
    if (previos === null) return;

    // Suena sólo cuando ENTRA una comanda que no estaba, no cada vez que la
    // lista cambia: despachar una también cambia la lista, y premiar eso con
    // una alarma entrenaría a la cocina a ignorarla.
    //
    // Y tampoco suena por lo que mandó ESTE aparato: al mesero no le tiene que
    // vibrar el teléfono en la mano por el pedido que acaba de enviar él. El
    // filtro va aquí y no en el store porque el de al lado —la tablet de
    // cocina— sí debe oírlo: lo que importa es qué aparato está mirando la
    // cola, no quién tomó la nota.
    const nuevas = cola.filter(
      (c) => !previos.has(c.comandaId) && !consumirComandaPropia(c.comandaId),
    );
    if (nuevas.length === 0) return;

    // El cocinero mira la notificación desde el bolsillo: tiene que poder
    // decidir si va o no sin desbloquear el teléfono, así que lleva mesa y
    // cuántos productos. Con varias de golpe se resume en vez de apilar N
    // notificaciones que se tapan entre sí.
    const primera = nuevas[0];
    const destino =
      primera.tipo === "para_llevar" ? "Para llevar" : `Mesa ${primera.mesaEtiqueta ?? "?"}`;
    const productos = primera.items.length;
    useAlertaCocinaStore.getState().reproducir(
      nuevas.length === 1
        ? {
            titulo: `Pedido nuevo · ${destino}`,
            cuerpo: `Comanda #${primera.numeroDia} · ${productos} ${
              productos === 1 ? "producto" : "productos"
            }`,
            tag: primera.comandaId,
          }
        : {
            titulo: `${nuevas.length} pedidos nuevos`,
            cuerpo: `Empezando por ${destino} · comanda #${primera.numeroDia}`,
            tag: "cola-despacho",
          },
    );
  }, [cola, status]);

  // Primer gesto del usuario: el único momento en que el navegador permite
  // sacar el contexto de `suspended`. `once` para no dejar listeners colgando.
  useEffect(() => {
    const desbloquear = () => useAlertaCocinaStore.getState().desbloquear();
    const opciones = { once: true } as const;
    window.addEventListener("pointerdown", desbloquear, opciones);
    window.addEventListener("keydown", desbloquear, opciones);
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, []);
}
