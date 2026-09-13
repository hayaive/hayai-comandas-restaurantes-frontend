import { httpApi } from "./httpClient";
import { mockApi } from "./mockClient";
import type { ApiClient } from "./types";

/**
 * The single seam between screens/stores and the backend.
 *
 * When `VITE_API_URL` is unset (default in development, since the backend
 * may not be deployed yet) every call runs against the in-memory mock
 * client. Set the env var once the real API is reachable and the whole app
 * switches over — no component or store needs to change.
 */
export const api: ApiClient = import.meta.env.VITE_API_URL ? httpApi : mockApi;

export const isUsingMockApi = !import.meta.env.VITE_API_URL;

export * from "./types";
