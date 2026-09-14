/**
 * Resolves relative media URLs the backend returns (e.g.
 * `/uploads/productos/<uuid>.jpg` from `uploadProductoImagen`) against the
 * backend's real origin.
 *
 * `VITE_API_URL` includes the API prefix (`http://localhost:3000/api/v1`,
 * see `.env.example` and `httpClient.ts`'s `baseUrl()`), but `/uploads` is
 * served by the backend OUTSIDE that prefix, straight off the root (see
 * `CONTRACT.md`, sección de uploads, and `main.ts`'s `useStaticAssets`). A
 * plain `<img src="/uploads/...">` would resolve against the FRONTEND's own
 * origin instead and 404 whenever frontend and backend are on different
 * hosts — which is the normal case in production. Every place that renders
 * `Producto.imagenUrl` (`ProductThumbnail`) must go through this.
 */
export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // Already absolute — an external URL pasted by staff, or a mock `blob:`
  // preview URL from `mockClient.ts`. Leave it as-is.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;

  const apiUrl = import.meta.env.VITE_API_URL;
  // Mock mode never returns relative URLs (`uploadProductoImagen`'s mock
  // always hands back a `blob:` URL), so there is nothing to resolve against.
  if (!apiUrl) return url;

  const origin = apiUrl.replace(/\/api\/v\d+\/?$/, "").replace(/\/+$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
