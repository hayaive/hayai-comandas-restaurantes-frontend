/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Hayai Comandas backend, e.g. "https://api.hayai.example".
   * Left unset in development: the app runs entirely on the in-memory mock
   * client (`src/api/mockClient.ts`) so screens work before the backend is
   * deployed. Set this once the backend is up — no component changes needed.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
