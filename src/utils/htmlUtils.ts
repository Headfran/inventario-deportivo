import { Linking, Platform } from 'react-native';

/**
 * Escapa cualquier valor que se vaya a interpolar dentro de HTML.
 * Evita XSS almacenado en tickets, catálogos y recibos impresos.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Valida un color hexadecimal antes de inyectarlo en un atributo style. */
export const safeColorHex = (value: unknown, fallback = '#cbd5e1'): string => {
  const candidate = String(value ?? '').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate)
    ? candidate
    : fallback;
};

const revokeBlobLater = (url: string) => {
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }, 60_000);
};

/**
 * Abre un HTML en una pestaña nueva. En web usa un Blob URL con
 * `noopener,noreferrer`; en nativo usa expo-print.
 *
 * Devuelve false solo si el entorno impide abrir/imprimir el documento.
 */
export const openPrintWindow = async (html: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof Blob === 'undefined') return false;
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      // Nota: con noopener el navegador devuelve null aunque la pestaña se
      // abra. No usamos el valor de retorno para detectar bloqueos; el HTML
      // incluye su propio window.print() en onload.
      window.open(url, '_blank', 'noopener,noreferrer');
      revokeBlobLater(url);
      return true;
    } catch (error) {
      console.warn('No se pudo abrir la ventana de impresión:', error);
      return false;
    }
  }

  try {
    const Print: any = await import('expo-print');
    await Print.printAsync({ html });
    return true;
  } catch (error) {
    console.warn('No se pudo imprimir en nativo:', error);
    return false;
  }
};

/** Abre enlaces externos (WhatsApp, etc.) sin exponer window.opener. */
export const openExternalLink = async (url: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

/** Envuelve un documento HTML completo y añade impresión automática. */
export const wrapPrintDocument = (title: string, bodyHtml: string, styles = ''): string => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
${bodyHtml}
<script>
  (function () {
    function doPrint() { try { window.print(); } catch (e) {} }
    window.onload = function () {
      var imgs = Array.prototype.slice.call(document.images);
      if (!imgs.length) { setTimeout(doPrint, 300); return; }
      var loaded = 0;
      function tick() { loaded += 1; if (loaded >= imgs.length) setTimeout(doPrint, 300); }
      imgs.forEach(function (img) {
        if (img.complete) { tick(); }
        else { img.addEventListener('load', tick); img.addEventListener('error', tick); }
      });
    };
  })();
</script>
</body>
</html>`;
