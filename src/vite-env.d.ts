/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /**
   * Base URL of the Hayai Comandas backend, e.g. "https://api.hayai.example".
   * Left unset in development: the app runs entirely on the in-memory mock
   * client (`src/api/mockClient.ts`) so screens work before the backend is
   * deployed. Set this once the backend is up — no component changes needed.
   */
  readonly VITE_API_URL?: string;
  /**
   * Nombre y RIF del restaurante impresos en la factura de cobro.
   *
   * Viven aquí y no en el backend porque `CONTRACT.md` no expone ningún
   * `GET /restaurante`: los campos existen en el esquema (`Restaurante.nombre`,
   * `Restaurante.rif`) pero ningún endpoint los devuelve. Cuando lo haga, el
   * único punto a cambiar es `src/components/facturacion/facturaMesaData.ts`.
   */
  readonly VITE_RESTAURANTE_NOMBRE?: string;
  readonly VITE_RESTAURANTE_RIF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
