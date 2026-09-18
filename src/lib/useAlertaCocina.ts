import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Alerta de la cola de despacho: cuando entra una comanda nueva mientras la
 * pantalla de cocina está abierta, suena una alarma de 3 segundos, vibra el
 * dispositivo y sale una notificación del sistema, para que nadie tenga que
 * estar mirando el monitor.
 *
 * Los tres canales son deliberadamente redundantes porque cada uno falla en un
 * escenario distinto: el audio no existe si el navegador aún no tuvo un gesto
 * del usuario, la vibración no existe en iOS, y la notificación necesita un
 * permiso que pueden denegar. Ninguno depende de los otros.
 *
 * LÍMITE IMPORTANTE: la notificación NO es Web Push. Avisa mientras la app
 * sigue viva —aunque esté en segundo plano o con la pantalla apagada—, pero
 * con la app cerrada del todo no llega nada. Para eso haría falta suscripción
 * push con claves VAPID y endpoints en el backend que guarden la suscripción
 * y disparen el envío al crear la comanda; hoy no existen.
 *
 * **Por qué se sintetiza en vez de usar un archivo.** No hay ningún asset de
 * audio en `public/` (sólo imágenes: favicon, logo, logo-mono), y agregar un
 * binario que no se puede escuchar ni verificar en esta sesión sería meter al
 * repo un archivo a ciegas. La Web Audio API genera el bip sin dependencias,
 * sin peso y sin red — y si algún día el dueño trae su propio sonido, el punto
 * de cambio es sólo `reproducir()`.
 *
 * **Autoplay.** Los navegadores no dejan sonar nada hasta que el usuario haya
 * interactuado con la página: un `AudioContext` creado antes nace `suspended`.
 * Por eso:
 *
 * - el contexto se crea perezosamente, no al montar;
 * - se intenta `resume()` en el primer gesto real del usuario (pointer/tecla),
 *   que es el momento en que el navegador lo permite;
 * - todo va envuelto en try/catch y en `.catch()`, porque `resume()` devuelve
 *   una promesa que se RECHAZA si el gesto todavía no ocurrió. Sin eso, un
 *   rechazo no capturado ensucia la consola en cada comanda nueva.
 *
 * El resultado: si el navegador bloquea el audio, la app no truena y la cola
 * sigue funcionando; el sonido entra solo en cuanto alguien toca la pantalla.
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
 * simplemente no vibra y el audio sigue haciendo su trabajo. No hay API
 * alternativa que emularla, así que se degrada en silencio.
 */
const PATRON_VIBRACION = TONOS.flatMap(() => [PULSO_S * 1000, SILENCIO_S * 1000]);

type ContextoConWebkit = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function crearContexto(): AudioContext | null {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as ContextoConWebkit).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    // Safari en modo restringido, o un entorno sin salida de audio.
    return null;
  }
}

/** Lo que se anuncia en la notificación. Sin esto sólo suena y vibra. */
export interface DetalleAlerta {
  titulo: string;
  cuerpo: string;
  /** Agrupa notificaciones de la misma comanda para no apilar duplicados. */
  tag?: string;
}

export type PermisoNotificacion = "default" | "granted" | "denied" | "no-soportado";

export interface AlertaCocina {
  /** Dispara la alarma. No lanza nunca: si algo está bloqueado, no suena. */
  reproducir: (detalle?: DetalleAlerta) => void;
  /** Corta la alarma en curso — para el botón de "ya voy" de la cocina. */
  detener: () => void;
  /** `true` mientras los 3 segundos siguen sonando. */
  sonando: boolean;
  activa: boolean;
  alternar: () => void;
  /**
   * Estado del permiso de notificaciones del navegador. `no-soportado` cuando
   * la API no existe (navegador viejo, o iOS sin instalar la PWA).
   */
  permisoNotificaciones: PermisoNotificacion;
  /**
   * Pide el permiso. DEBE llamarse desde un gesto real del usuario: los
   * navegadores ignoran (o penalizan) la petición automática al cargar.
   */
  pedirPermisoNotificaciones: () => void;
  /**
   * `true` cuando el navegador todavía no dejó sonar nada porque falta un
   * gesto del usuario. La UI lo usa para avisar en vez de mentir con un icono
   * de "sonido activo" que no suena.
   */
  bloqueadaPorNavegador: boolean;
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
 *
 * ALCANCE: esto NO es Web Push. Avisa mientras la app sigue viva (aunque esté
 * de fondo); con la app cerrada del todo haría falta suscripción push con
 * claves VAPID y un endpoint en el backend que las guarde y dispare el envío
 * — trabajo de servidor que no existe todavía.
 */
async function notificar(detalle: DetalleAlerta): Promise<void> {
  if (leerPermiso() !== "granted") return;
  const opciones: NotificationOptions = {
    body: detalle.cuerpo,
    icon: "/logo.jpg",
    badge: "/logo-mono.png",
    tag: detalle.tag,
    // Sin esto, en Android la notificación se va sola en pocos segundos y el
    // cocinero que estaba de espaldas no se entera de que llegó.
    requireInteraction: true,
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

function vibrar(): void {
  try {
    navigator.vibrate?.(PATRON_VIBRACION);
  } catch {
    /* Algunos navegadores lanzan si el patrón excede su límite. */
  }
}

export function useAlertaCocina(): AlertaCocina {
  const contextRef = useRef<AudioContext | null>(null);
  /** Osciladores en vuelo, para poder cortar los 3 segundos a mitad. */
  const osciladoresRef = useRef<OscillatorNode[]>([]);
  const finTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activa, setActiva] = useState(true);
  const [bloqueada, setBloqueada] = useState(false);
  const [sonando, setSonando] = useState(false);
  const [permiso, setPermiso] = useState<PermisoNotificacion>(leerPermiso);

  const obtenerContexto = useCallback((): AudioContext | null => {
    if (!contextRef.current) contextRef.current = crearContexto();
    return contextRef.current;
  }, []);

  // Primer gesto del usuario: el único momento en que el navegador permite
  // sacar el contexto de `suspended`. `once` para no dejar listeners colgando.
  useEffect(() => {
    function desbloquear() {
      const ctx = obtenerContexto();
      if (!ctx) return;
      ctx
        .resume()
        .then(() => setBloqueada(false))
        .catch(() => {
          /* Sigue bloqueado; se reintenta en el próximo gesto. */
        });
    }
    const opciones = { once: true } as const;
    window.addEventListener("pointerdown", desbloquear, opciones);
    window.addEventListener("keydown", desbloquear, opciones);
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, [obtenerContexto]);

  // Cerrar el contexto al desmontar: la pantalla de cocina vive horas abiertas
  // y no tiene por qué dejar un AudioContext vivo al navegar a otra ruta.
  useEffect(() => {
    return () => {
      // Sin esto, salir de la pantalla a mitad de la alarma dejaba el timer
      // vivo y la vibración corriendo hasta agotar el patrón.
      if (finTimerRef.current) clearTimeout(finTimerRef.current);
      try {
        navigator.vibrate?.(0);
      } catch {
        /* Sin soporte: no había nada que cancelar. */
      }
      contextRef.current?.close().catch(() => {
        /* Ya estaba cerrado. */
      });
      contextRef.current = null;
    };
  }, []);

  const detener = useCallback(() => {
    for (const osc of osciladoresRef.current) {
      try {
        osc.stop();
      } catch {
        /* Ya había terminado solo. */
      }
    }
    osciladoresRef.current = [];
    if (finTimerRef.current) {
      clearTimeout(finTimerRef.current);
      finTimerRef.current = null;
    }
    try {
      // `vibrate(0)` es la forma de cancelar un patrón en curso.
      navigator.vibrate?.(0);
    } catch {
      /* Sin soporte: no había nada que cancelar. */
    }
    setSonando(false);
  }, []);

  const reproducir = useCallback(
    (detalle?: DetalleAlerta) => {
      if (!activa) return;

      // Vibración y notificación NO dependen del AudioContext: si el navegador
      // tiene el audio bloqueado por falta de gesto, el teléfono igual avisa.
      vibrar();
      if (detalle) void notificar(detalle);

      const ctx = obtenerContexto();
      if (!ctx) return;

      const emitir = () => {
        try {
          // Una alarma nueva reemplaza a la que sigue sonando en vez de
          // superponerse: dos patrones a destiempo suenan a ruido, no a alerta.
          detener();
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
            osciladoresRef.current.push(osc);
          }
          setSonando(true);
          finTimerRef.current = setTimeout(() => {
            osciladoresRef.current = [];
            finTimerRef.current = null;
            setSonando(false);
          }, DURACION_ALERTA_S * 1000);
          setBloqueada(false);
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
          .catch(() => setBloqueada(true));
        return;
      }
      emitir();
    },
    [activa, detener, obtenerContexto],
  );

  const pedirPermisoNotificaciones = useCallback(() => {
    if (typeof Notification === "undefined") {
      setPermiso("no-soportado");
      return;
    }
    Notification.requestPermission()
      .then(setPermiso)
      .catch(() => {
        /* El usuario cerró el diálogo: el permiso sigue como estaba. */
      });
  }, []);

  const alternar = useCallback(() => {
    setActiva((previa) => {
      const siguiente = !previa;
      // Encender el sonido ES un gesto del usuario: aprovéchalo para
      // desbloquear el contexto en el mismo clic.
      if (siguiente) {
        obtenerContexto()
          ?.resume()
          .then(() => setBloqueada(false))
          .catch(() => setBloqueada(true));
      }
      return siguiente;
    });
  }, [obtenerContexto]);

  return {
    reproducir,
    detener,
    sonando,
    activa,
    alternar,
    permisoNotificaciones: permiso,
    pedirPermisoNotificaciones,
    bloqueadaPorNavegador: bloqueada && activa,
  };
}
