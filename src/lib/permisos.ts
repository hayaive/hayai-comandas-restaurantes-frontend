import { MODULOS_ASIGNABLES, TODOS_LOS_MODULOS } from "@/api";
import type { ModuloApp, Usuario } from "@/api";
import { useAuthStore } from "./useAuthStore";
import { navItems } from "@/components/layout/navItems";

/**
 * Punto único de "¿puede ver esto?" — todo lo demás (Sidebar, MobileBottomNav,
 * MobileMoreSheet, el guard de rutas, la home tras login) pasa por aquí para
 * que la regla nunca pueda divergir entre dos sitios.
 *
 * Dos funciones puras (`modulosDe`, `tieneModulo`) más el hook de conveniencia
 * (`usePuedeVer`) para un componente que sólo necesita consultar UN módulo.
 * Donde hace falta filtrar una LISTA (`Array.prototype.filter`), usa las
 * funciones puras directamente con el `usuario`/`modulosListos` leídos una
 * sola vez arriba — llamar un hook dentro de un callback de `.filter()`
 * rompería las reglas de hooks.
 */

/**
 * Módulos efectivos de un usuario. `administrador` "ve todo" en el cliente
 * aunque el backend ya los mande efectivos — es la doble defensa que pide el
 * brief: si algún día el backend dejara de mandarlos completos, el
 * administrador no se queda afuera de su propia app.
 */
export function modulosDe(usuario: Usuario | null): ModuloApp[] {
  if (!usuario) return [];
  if (usuario.rol === "administrador") return TODOS_LOS_MODULOS;
  // ⚠️ SIN lista de módulos NO significa "sin permisos": significa "sesión de
  // antes de que existieran los módulos". Antes esto devolvía `[]`, y como
  // `refrescarModulos` marca la sesión como lista pase lo que pase, dejaba EN
  // BLANCO a todo el personal que no fuera administrador en dos casos reales:
  //   · el día del despliegue — el frontend compila en un minuto y el backend
  //     además corre la migración, así que durante ese rato el frontend nuevo
  //     habla con un backend viejo cuyo `/auth/yo` no manda `modulos`;
  //   · abrir la app sin red con una sesión guardada antes del cambio.
  // Una sesión sin `modulos` sólo puede ser de personal PERMANENTE (un acceso
  // temporal nace ya con su lista), y a ese personal la migración le da
  // exactamente `MODULOS_ASIGNABLES`. Así que esto no concede nada que el
  // servidor no vaya a conceder igual — y si concediera de más, el backend
  // sigue respondiendo 403: esto sólo decide qué se PINTA.
  if (!Array.isArray(usuario.modulos)) return MODULOS_ASIGNABLES;
  return usuario.modulos;
}

/**
 * ¿Puede ver `modulo`? Mientras `modulosListos` sea `false` (sesión vieja sin
 * `modulos`, todavía esperando `GET /auth/yo`) responde `true` A PROPÓSITO:
 * decidir "no lo tiene" con un dato que no llegó es exactamente el bug que
 * dejaría a todo el personal en blanco el día del deploy. Ver
 * `useAuthStore.modulosListos`.
 */
export function tieneModulo(
  usuario: Usuario | null,
  modulosListos: boolean,
  modulo: ModuloApp,
): boolean {
  if (!usuario) return false;
  if (usuario.rol === "administrador") return true;
  if (!modulosListos) return true;
  return modulosDe(usuario).includes(modulo);
}

/**
 * Igual que `tieneModulo`, pero CONSERVADORA: mientras `modulosListos` sea
 * `false` responde `false`. Para lo que arranca pidiendo datos a un endpoint
 * que 403ea sin el módulo correcto (la cola de despacho, las cuentas por
 * cobrar, la alarma de cocina) — ahí vale más esperar un round-trip de más
 * que arriesgar una tanda de 403 contra un módulo que al final no se tiene.
 */
export function tieneModuloConfirmado(
  usuario: Usuario | null,
  modulosListos: boolean,
  modulo: ModuloApp,
): boolean {
  if (!usuario) return false;
  if (usuario.rol === "administrador") return true;
  if (!modulosListos) return false;
  return modulosDe(usuario).includes(modulo);
}

/** Hook de conveniencia para un componente que sólo consulta un módulo. */
export function usePuedeVer(modulo: ModuloApp): boolean {
  const usuario = useAuthStore((s) => s.usuario);
  const modulosListos = useAuthStore((s) => s.modulosListos);
  return tieneModulo(usuario, modulosListos, modulo);
}

/**
 * La primera pantalla concedida, en el orden de `navItems` — es la home tras
 * el login/canje y el destino del guard de rutas cuando alguien entra a una
 * pantalla que no tiene. Antes de este cambio ambas estaban fijas en
 * `/mesas`, lo que rompía para un mesero temporal sin ese módulo.
 */
export function primeraPantallaConcedida(usuario: Usuario | null, modulosListos: boolean): string {
  const item = navItems.find((it) => tieneModulo(usuario, modulosListos, it.modulo));
  return item?.to ?? "/mesas";
}
