// src/utils/url.js

// Considera http(s)://, //, data:, blob:
const ABSOLUTE_PROTOCOL_RE = /^(?:[a-z]+:)?\/\//i;

export function isAbsoluteUrl(value) {
  if (!value) return false;
  return (
    ABSOLUTE_PROTOCOL_RE.test(value) ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
}

function normalizePath(p) {
  if (!p) return '';
  // Backslashes -> slashes y asegurar leading slash
  const s = String(p).replace(/\\/g, '/');
  return s.startsWith('/') ? s : `/${s}`;
}

/**
 * Devuelve el ORIGIN del backend (sin el sufijo /api).
 * Usa VITE_API_BASE_URL si existe (ej. https://midominio.com/api).
 * Si no existe, intenta VITE_ASSETS_BASE_URL; si tampoco, usa el origin del navegador.
 */
export function getBackendOrigin() {
  const apiBase = import.meta?.env?.VITE_API_BASE_URL;
  if (apiBase) {
    try {
      const u = new URL(apiBase, window.location.origin);
      return u.origin; // quita cualquier path como /api
    } catch {
      /* ignore y seguimos */
    }
  }

  const assetsBase = import.meta?.env?.VITE_ASSETS_BASE_URL;
  if (assetsBase) {
    try {
      return new URL(assetsBase, window.location.origin).origin;
    } catch {
      /* ignore */
    }
  }

  return window.location.origin;
}

/**
 * Convierte una ruta relativa del backend en URL absoluta.
 *
 * Ejemplos:
 * absolutizeApiUrl('/uploads/avatar/a.jpg') -> 'https://api-host.tld/uploads/avatar/a.jpg'
 * absolutizeApiUrl('uploads/avatar/a.jpg')  -> 'https://api-host.tld/uploads/avatar/a.jpg'
 * absolutizeApiUrl('http://otro.tld/x.png') -> se retorna tal cual (ya es absoluta)
 * absolutizeApiUrl('')                      -> ''
 */
export function absolutizeApiUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;

  const origin = getBackendOrigin();
  return (origin + normalizePath(pathOrUrl)).replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Une un base URL (absoluto o relativo al backend) con más partes de ruta.
 * - Normaliza / y evita // (excepto en el protocolo).
 */
export function joinUrl(base, ...parts) {
  if (!base) return absolutizeApiUrl(parts.join('/'));
  const absBase = isAbsoluteUrl(base)
    ? base
    : getBackendOrigin() + normalizePath(base);
  const tail = parts.map(normalizePath).join('');
  return (absBase + tail).replace(/([^:]\/)\/+/g, '$1');
}
