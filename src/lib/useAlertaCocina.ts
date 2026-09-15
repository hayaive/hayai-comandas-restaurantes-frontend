import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Alerta sonora de la cola de despacho: cuando entra una comanda nueva
 * mientras la pantalla de cocina está abierta, suena un bip corto para que
 * nadie tenga que estar mirando el monitor.
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

/** Un bip de dos tonos, corto y seco. Suficiente para cortar el ruido de cocina. */
const TONOS: { frecuencia: number; inicio: number; duracion: number }[] = [
  { frecuencia: 880, inicio: 0, duracion: 0.12 },
  { frecuencia: 1320, inicio: 0.14, duracion: 0.18 },
];

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

export interface AlertaCocina {
  /** Reproduce el bip. No lanza nunca: si el audio está bloqueado, no suena. */
  reproducir: () => void;
  activa: boolean;
  alternar: () => void;
  /**
   * `true` cuando el navegador todavía no dejó sonar nada porque falta un
   * gesto del usuario. La UI lo usa para avisar en vez de mentir con un icono
   * de "sonido activo" que no suena.
   */
  bloqueadaPorNavegador: boolean;
}

export function useAlertaCocina(): AlertaCocina {
  const contextRef = useRef<AudioContext | null>(null);
  const [activa, setActiva] = useState(true);
  const [bloqueada, setBloqueada] = useState(false);

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
      contextRef.current?.close().catch(() => {
        /* Ya estaba cerrado. */
      });
      contextRef.current = null;
    };
  }, []);

  const reproducir = useCallback(() => {
    if (!activa) return;
    const ctx = obtenerContexto();
    if (!ctx) return;

    const emitir = () => {
      try {
        const ahora = ctx.currentTime;
        for (const tono of TONOS) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = tono.frecuencia;
          // Rampa de entrada y salida: un gain que salta de 0 a 1 de golpe
          // produce un "click" audible al principio y al final del tono.
          const inicio = ahora + tono.inicio;
          const fin = inicio + tono.duracion;
          gain.gain.setValueAtTime(0.0001, inicio);
          gain.gain.exponentialRampToValueAtTime(0.25, inicio + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, fin);
          osc.connect(gain).connect(ctx.destination);
          osc.start(inicio);
          osc.stop(fin + 0.02);
        }
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
  }, [activa, obtenerContexto]);

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

  return { reproducir, activa, alternar, bloqueadaPorNavegador: bloqueada && activa };
}
