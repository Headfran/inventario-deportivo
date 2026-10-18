import { Platform } from 'react-native';
import { Product } from '../types/inventory';

export interface CatalogPrintOptions {
  showPrices: boolean;
  storeName?: string;
  categoryFilterName?: string;
  subtitle?: string;
}

export interface CatalogPrintProgress {
  phase: 'starting' | 'downloading' | 'building' | 'printing' | 'done';
  done: number;
  total: number;
  message?: string;
}

export interface CatalogPrintHandlers {
  onProgress?: (p: CatalogPrintProgress) => void;
  shouldCancel?: () => boolean;
}

// ==========================================
// Config de compresión/rendimiento
// ==========================================
const IMAGE_MAX_WIDTH = 500;       // suficiente para A4 a 3 columnas
const IMAGE_QUALITY = 0.7;         // JPEG calidad 70%
const DOWNLOAD_CONCURRENCY = 6;    // descargas en paralelo
const IMAGE_TIMEOUT_MS = 5000;     // por imagen
const IMAGE_SETTINGS = Platform.OS === 'web'
  ? { maxWidth: 500, quality: 0.7 }   // Web: buen detalle, navegador aguanta
  : { maxWidth: 380, quality: 0.58 }; // Nativo: más ligero (evita OOM en print dialog)

// ==========================================
// Placeholder SVG inline
// ==========================================
const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#f1f5f9"/>
      <text x="150" y="150" font-family="system-ui, sans-serif" font-size="16" fill="#94a3b8"
            text-anchor="middle" dominant-baseline="middle">Sin foto</text>
    </svg>`
  );

// ==========================================
// ORDEN CANÓNICO DE TALLAS
// ==========================================
const SIZE_RANK: Record<string, number> = {
  'SS': -2, 'XXS': -2, 'XS': -1,
  'S': 0, 'M': 1, 'L': 2, 'XL': 3,
  '2XL': 4, 'XXL': 4,
  '3XL': 5, 'XXXL': 5,
  '4XL': 6, 'XXXXL': 6,
  '5XL': 7, 'XXXXXL': 7,
  '6XL': 8, 'XXXXXXL': 8,
};

const SIZE_SPECIAL = new Set([
  'ÚNICA', 'UNICA', 'ÚNICO', 'UNICO',
  'U', 'AJUSTABLE', 'ONE SIZE', 'TALLA ÚNICA', 'TALLA UNICA',
  'ESTÁNDAR', 'ESTANDAR',
]);

const sizeRank = (rawSize: any): number => {
  const s = String(rawSize ?? '').trim().toUpperCase();
  if (!s) return 5000;
  if (SIZE_SPECIAL.has(s)) return 10000;
  const num = parseFloat(s);
  if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(s)) return num;
  if (SIZE_RANK[s] !== undefined) return SIZE_RANK[s];
  return 5000;
};

const sortSizes = (sizes: string[]): string[] => {
  return [...sizes].sort((a, b) => {
    const ra = sizeRank(a);
    const rb = sizeRank(b);
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), 'es', { numeric: true });
  });
};

// ==========================================
// Pool de concurrencia (limita descargas simultáneas)
// ==========================================
const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  shouldCancel?: () => boolean
): Promise<(R | null)[]> => {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (shouldCancel?.()) return;
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = null;
      }
    }
  });

  await Promise.all(workers);
  return results;
};

// ==========================================
// Helpers web
// ==========================================
const getBrowserDocument = (): Document | null => {
  if (typeof window !== 'undefined' && (window as any).document) {
    return (window as any).document as Document;
  }
  if (typeof document !== 'undefined') return document;
  return null;
};

const getHTMLImageCtor = (): any => {
  if (typeof window !== 'undefined' && (window as any).Image) {
    return (window as any).Image;
  }
  return null;
};

// ==========================================
// Compresión web (canvas, sin crossOrigin)
// ==========================================
const compressImageWeb = (
  url: string,
  maxWidth = IMAGE_MAX_WIDTH,
  quality = IMAGE_QUALITY,
  timeoutMs = IMAGE_TIMEOUT_MS
): Promise<string> => {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: string) => { if (!settled) { settled = true; resolve(r); } };

    const ImgCtor = getHTMLImageCtor();
    const doc = getBrowserDocument();
    if (!ImgCtor || !doc) return done(url);

    let img: HTMLImageElement;
    try { img = new ImgCtor(); } catch { return done(url); }

    img.onload = () => {
      try {
        const nw = img.naturalWidth || img.width || 0;
        const nh = img.naturalHeight || img.height || 0;
        if (!nw || !nh) return done(url);

        const canvas = doc.createElement('canvas');
        if (!canvas) return done(url);

        const ratio = Math.min(1, maxWidth / nw);
        const w = Math.max(1, Math.round(nw * ratio));
        const h = Math.max(1, Math.round(nh * ratio));
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) return done(url);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        done(canvas.toDataURL('image/jpeg', quality));
      } catch {
        done(url);
      }
    };

    img.onerror = () => done(FALLBACK_IMAGE);
    setTimeout(() => done(url), timeoutMs);

    try { img.src = url; } catch { done(url); }
  });
};

// ==========================================
// Descarga + compresión nativa CON TIMEOUT
// ==========================================
let imageManipulatorCache: any | null | undefined = undefined;

const loadImageManipulator = async (): Promise<any | null> => {
  if (imageManipulatorCache !== undefined) return imageManipulatorCache;
  try {
    imageManipulatorCache = await import('expo-image-manipulator');
    return imageManipulatorCache;
  } catch {
    imageManipulatorCache = null;
    return null;
  }
};

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
};

const compressImageNative = async (url: string): Promise<string | null> => {
  const process = async (): Promise<string | null> => {
    try {
      const FileSystem: any = await import('expo-file-system/legacy');
      const ImageManipulator = await loadImageManipulator();

      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!cacheDir) return null;

      const cachePath = getCachedImagePath(cacheDir, url);

      // 1) Caché
      const cached = await readFromCache(cachePath);
      if (cached) return cached;

      // 2) Descargar
      const tempUri = `${cacheDir}cat_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { uri } = await FileSystem.downloadAsync(url, tempUri);

      try {
        let base64Result: string | null = null;

        if (ImageManipulator?.manipulateAsync) {
          const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: IMAGE_SETTINGS.maxWidth } }],   // ← usa settings
            { compress: IMAGE_SETTINGS.quality, format: 'jpeg', base64: false }
          );

          if (result?.uri) {
            try { await FileSystem.copyAsync({ from: result.uri, to: cachePath }); } catch { /* noop */ }
            const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: 'base64' });
            base64Result = `data:image/jpeg;base64,${base64}`;
            try { await FileSystem.deleteAsync(result.uri, { idempotent: true }); } catch { /* noop */ }
          }
        }

        if (!base64Result) {
          try { await FileSystem.copyAsync({ from: uri, to: cachePath }); } catch { /* noop */ }
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          base64Result = `data:image/jpeg;base64,${base64}`;
        }

        return base64Result;
      } finally {
        try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch { /* noop */ }
      }
    } catch {
      return null;
    }
  };

  return withTimeout(process(), 12000, null);
};

/** Reintentos con backoff + fallback a URL original */
const compressImageNativeWithRetry = async (url: string): Promise<string> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await compressImageNative(url);
    if (result) return result;
    if (attempt < 1) {
      // Backoff antes de reintentar
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  // 🔧 FALLBACK: URL original (el WebView del PDF la intentará cargar)
  // Solo usar placeholder si la URL está vacía
  return url || FALLBACK_IMAGE;
};

// ==========================================
// Precarga con pool + progreso INMEDIATO
// ==========================================
const preloadImages = async (
  products: Product[],
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean
): Promise<Map<string, string>> => {
  const urls = new Set<string>();
  (products || []).forEach((p) => {
    const first = p?.images?.[0];
    if (first) urls.add(first);
  });

  const urlList = Array.from(urls);
  const map = new Map<string, string>();
  let done = 0;

  try { onProgress?.(0, urlList.length); } catch { /* noop */ }
  if (urlList.length === 0) return map;

  await runWithConcurrency(
    urlList,
    DOWNLOAD_CONCURRENCY,
    async (url) => {
      if (shouldCancel?.()) return;
      try {
        if (Platform.OS === 'web') {
          const ready = await compressImageWeb(url);
          map.set(url, ready);
        } else {
          // 🔧 Cambio: usar versión con retry + fallback a URL
          const ready = await compressImageNativeWithRetry(url);
          map.set(url, ready);
        }
      } catch {
        // Fallback final: URL original
        map.set(url, url || FALLBACK_IMAGE);
      } finally {
        done++;
        try { onProgress?.(done, urlList.length); } catch { /* noop */ }
      }
    },
    shouldCancel
  );

  return map;
};

// ==========================================
// HTML de carga
// ==========================================
const buildLoadingHtml = (storeName: string): string => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${storeName} — Preparando catálogo...</title>
  <style>
    body { margin: 0; height: 100vh; display: flex; flex-direction: column;
      justify-content: center; align-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc; color: #0f172a; }
    .spinner { width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 16px; margin: 16px 0 4px; font-weight: 700; }
    p  { font-size: 13px; color: #64748b; margin: 0; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h1>Preparando catálogo</h1>
  <p id="status">Optimizando imágenes…</p>
</body>
</html>`;

// ==========================================
// HTML final
// ==========================================
const buildCatalogHtml = (
  products: Product[],
  options: CatalogPrintOptions,
  imageMap: Map<string, string>
): string => {
  const { showPrices, storeName = 'Catálogo de Prendas', categoryFilterName, subtitle } = options;

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const cardsMarkup = (products || []).map((p) => {
    const originalUrl = p.images?.[0] || '';
    const readyUrl = imageMap.get(originalUrl) || FALLBACK_IMAGE;

    const variantsMarkup = (p.variants || []).map((v: any) => {
      const availableSizes = sortSizes(
        (v.sizes || [])
          .filter((s: any) => Number(s.stock) > 0)
          .map((s: any) => String(s.size))
      ).join(' · ');

      const colorHex = v.colorHex || '#94a3b8';
      const isOut = !availableSizes;

      return `
        <div class="variant-row">
          <span class="color-dot" style="background:${colorHex}"></span>
          <span class="color-name">${v.color || 'Sin color'}</span>
          <span class="sizes ${isOut ? 'sizes-out' : ''}">${isOut ? 'Agotado' : availableSizes}</span>
        </div>`;
    }).join('');

    const totalStock = (p.variants || []).reduce(
      (acc: number, v: any) =>
        acc + (v.sizes || []).reduce((a: number, s: any) => a + (Number(s.stock) || 0), 0),
      0
    );
    const isOutOfStock = totalStock === 0;

    return `
    <article class="card">
      <div class="img-wrap">
        <img src="${readyUrl}" alt="${(p.name || '').replace(/"/g, '&quot;')}" loading="eager" />
        ${isOutOfStock ? '<span class="badge-out">AGOTADO</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-brand">${p.brand || 'SIN MARCA'}</div>
        <div class="card-name">${p.name || ''}</div>
        <div class="card-code">SKU: ${p.code || '—'}</div>
        <div class="variants">${variantsMarkup || '<div class="variant-row"><span class="color-name">Sin variantes</span></div>'}</div>
      </div>
      ${showPrices ? `<div class="card-price">$${Number(p.price || 0).toFixed(2)}</div>` : ''}
    </article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${storeName} — Catálogo</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 9999; }
    .toolbar button { padding: 10px 16px; font-size: 13px; font-weight: 700; border-radius: 8px;
      border: 1px solid #e2e8f0; background: #ffffff; color: #0f172a; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .toolbar button.primary { background: #2563eb; border-color: #2563eb; color: #ffffff; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px 24px 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
      border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 22px; }
    .header-left { flex: 1; min-width: 0; }
    .store-title { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0;
      letter-spacing: -0.3px; text-transform: uppercase; line-height: 1.1; }
    .store-subtitle { font-size: 12px; color: #64748b; margin: 6px 0 0; line-height: 1.5; }
    .store-subtitle strong { color: #2563eb; }
    .header-right { text-align: right; font-size: 11px; color: #475569; line-height: 1.6; white-space: nowrap; }
    .header-right strong { color: #0f172a; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .card { display: flex; flex-direction: column; background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 10px; overflow: hidden; break-inside: avoid; page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .img-wrap { position: relative; width: 100%; aspect-ratio: 1 / 1; background: #f1f5f9; overflow: hidden; }
    .img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badge-out { position: absolute; top: 8px; right: 8px; background: #ef4444; color: #ffffff;
      font-size: 9px; font-weight: 900; letter-spacing: 0.5px; padding: 3px 7px; border-radius: 4px; }
    .card-body { padding: 10px 12px 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .card-brand { font-size: 9px; font-weight: 800; color: #2563eb; letter-spacing: 1px; text-transform: uppercase; }
    .card-name { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.25; margin: 2px 0 4px; }
    .card-code { font-size: 10px; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
    .variants { border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-bottom: 8px;
      display: flex; flex-direction: column; gap: 3px; }
    .variant-row { display: flex; align-items: center; gap: 5px; font-size: 10px; line-height: 1.3; }
    .color-dot { width: 8px; height: 8px; border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0; }
    .color-name { font-weight: 700; color: #334155; flex-shrink: 0; }
    .sizes { margin-left: auto; color: #059669; font-weight: 600; text-align: right; }
    .sizes-out { color: #ef4444; font-style: italic; font-weight: 500; }
    .card-price { font-size: 16px; font-weight: 900; color: #0f172a; padding: 8px 12px 10px;
      border-top: 1px solid #f1f5f9; text-align: right; letter-spacing: -0.2px; }
    .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #e2e8f0;
      font-size: 10px; color: #94a3b8; text-align: center; line-height: 1.5; }
    @media (max-width: 800px) {
      .grid { grid-template-columns: repeat(2, 1fr); }
      .page { padding: 24px 16px 16px; }
      .store-title { font-size: 20px; }
      .header { flex-direction: column; align-items: flex-start; }
      .header-right { text-align: left; white-space: normal; }
    }
    @media print {
      .toolbar { display: none !important; }
      .page { padding: 0; max-width: none; }
      .card { box-shadow: none; }
      .grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .header { margin-bottom: 16px; padding-bottom: 10px; }
      .store-title { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="try{window.print()}catch(e){console.error(e)}" class="primary">🖨️ Imprimir / PDF</button>
    <button onclick="try{window.close()}catch(e){}">Cerrar</button>
  </div>

  <div class="page">
    <header class="header">
      <div class="header-left">
        <h1 class="store-title">${storeName}</h1>
        <p class="store-subtitle">
          ${categoryFilterName ? `<strong>Categoría:</strong> ${categoryFilterName} • ` : ''}
          ${subtitle || `<strong>${(products || []).length}</strong> prendas en catálogo`}
        </p>
      </div>
      <div class="header-right">
        <div><strong>Fecha:</strong> ${currentDate}</div>
        <div><strong>Modalidad:</strong> ${showPrices ? 'Con precios' : 'Solo exhibición'}</div>
      </div>
    </header>

    <main class="grid">
      ${cardsMarkup || '<p style="grid-column:1/-1;text-align:center;color:#94a3b8;font-style:italic">Sin prendas para mostrar</p>'}
    </main>

    <footer class="footer">
      Documento generado automáticamente por el Sistema de Inventario.<br/>
      Precios y disponibilidad sujetos a cambio sin previo aviso.
    </footer>
  </div>

  <script>
    (function () {
      try {
        function doPrint() {
          try { window.print(); } catch (e) { console.error('[Catalog] print failed:', e); }
        }
        function whenReady() {
          try {
            var imgs = Array.prototype.slice.call(document.images || []);
            var pending = imgs.length;
            if (pending === 0) { setTimeout(doPrint, 300); return; }
            var done = function () {
              pending--;
              if (pending <= 0) setTimeout(doPrint, 300);
            };
            imgs.forEach(function (img) {
              if (img.complete && (img.naturalWidth || img.width) > 0) { done(); return; }
              var finished = false;
              var finish = function () { if (finished) return; finished = true; done(); };
              img.addEventListener('load', finish, { once: true });
              img.addEventListener('error', finish, { once: true });
              setTimeout(finish, 3000);
            });
          } catch (e) {
            console.error('[Catalog] whenReady failed:', e);
            setTimeout(doPrint, 300);
          }
        }
        if (document.readyState === 'complete') whenReady();
        else window.addEventListener('load', whenReady, { once: true });
      } catch (e) {
        console.error('[Catalog] IIFE failed:', e);
      }
    })();
  </script>
</body>
</html>`;
};

// ==========================================
// Impresión nativa (con detección de Expo Go)
// ==========================================
const printNative = async (html: string): Promise<void> => {
  const Print: any = await import('expo-print');
  const Sharing: any = await import('expo-sharing');
  const FileSystem: any = await import('expo-file-system/legacy');
  const Constants: any = (await import('expo-constants')).default;

  // Detectar Expo Go
  const isExpoGo =
    Constants?.executionEnvironment === 'storeClient' ||
    Constants?.appOwnership === 'expo' ||
    String((Constants as any)?.executionEnvironment || '').toLowerCase().includes('storeclient');

  console.log('[Catalog] printNative | isExpoGo:', isExpoGo);

  // ============ EXPO GO: printAsync directo (shareAsync no funciona) ============
  if (isExpoGo) {
    console.log('[Catalog] Expo Go → usando diálogo de impresión del sistema');
    // printAsync abre el diálogo nativo: "Guardar como PDF" o enviar a impresora.
    await Print.printAsync({ html });
    return;
  }

  // ============ STANDALONE: flujo shareAsync normal ============
  let pdfUri: string | null = null;
  try {
    const result = await Print.printToFileAsync({ html });
    pdfUri = result?.uri || null;
    console.log('[Catalog] PDF generado en:', pdfUri);
  } catch (e) {
    console.warn('[Catalog] printToFileAsync failed:', e);
  }

  if (pdfUri) {
    try {
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (dir) {
        const safeUri = `${dir}catalogo_${Date.now()}.pdf`;
        await FileSystem.copyAsync({ from: pdfUri, to: safeUri });

        const info = await FileSystem.getInfoAsync(safeUri);
        if (info?.exists) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(safeUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Compartir catálogo',
            });
            console.log('[Catalog] PDF compartido OK');
            return;
          }
        }
      }
    } catch (e: any) {
      console.warn('[Catalog] share path failed:', e?.message || e);
    }
  }

  // Fallback: printAsync (siempre disponible)
  console.log('[Catalog] Fallback: printAsync');
  await Print.printAsync({ html });
};

// ==========================================
// Impresión web (iframe fallback)
// ==========================================
const printViaIframe = (html: string): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const doc = getBrowserDocument();
      if (!doc || !doc.body) { resolve(); return; }

      const iframe = doc.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      doc.body.appendChild(iframe);

      const iframeWin: any = (iframe as any).contentWindow;
      const iframeDoc: any = (iframe as any).contentDocument || iframeWin?.document;
      if (!iframeDoc) { doc.body.removeChild(iframe); resolve(); return; }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      setTimeout(() => {
        try {
          if (iframeWin && typeof iframeWin.print === 'function') {
            iframeWin.focus();
            iframeWin.print();
          }
        } finally {
          setTimeout(() => {
            try { doc.body.removeChild(iframe); } catch { /* noop */ }
          }, 5000);
          resolve();
        }
      }, 800);
    } catch {
      resolve();
    }
  });
};

// ==========================================
// API pública
// ==========================================
export const generateCatalogPrint = async (
  products: Product[],
  options: CatalogPrintOptions,
  handlers?: CatalogPrintHandlers
): Promise<void> => {
  const emit = (p: CatalogPrintProgress) => {
    try { handlers?.onProgress?.(p); } catch { /* noop */ }
  };
  const cancelled = () => !!handlers?.shouldCancel?.();

  console.log('[Catalog] Inicio. Productos:', Array.isArray(products) ? products.length : 'NO ES ARRAY', '| Platform:', Platform.OS);

  const storeName = options?.storeName || 'Catálogo';

  // ============ NATIVO ============
  if (Platform.OS !== 'web') {
    // 🔧 Emitir con total conocido desde el inicio para que la barra tenga 0/N
    const totalImgs = new Set(
      products.map((p) => p.images?.[0]).filter(Boolean)
    ).size;

    emit({
      phase: 'downloading',
      done: 0,
      total: totalImgs,
      message: totalImgs > 0 ? `Optimizando 0 de ${totalImgs}…` : 'Preparando…',
    });

    const imageMap = await preloadImages(
      products,
      (done, total) => {
        emit({
          phase: 'downloading',
          done,
          total,
          message: `Optimizando imagen ${done} de ${total}…`,
        });
      },
      cancelled
    );

    if (cancelled()) {
      console.log('[Catalog] Cancelado por el usuario');
      return;
    }

    emit({ phase: 'building', done: 0, total: 0, message: 'Generando documento PDF…' });
    const html = buildCatalogHtml(products, options, imageMap);

    if (cancelled()) return;

    emit({ phase: 'printing', done: 0, total: 0, message: 'Abriendo compartir…' });
    await printNative(html);

    emit({ phase: 'done', done: 0, total: 0, message: 'Listo' });
    return;
  }

  // ============ WEB ============
  emit({ phase: 'starting', done: 0, total: 0, message: 'Preparando…' });

  let printWindow: any = null;
  let usedWindow = false;

  try {
    if (typeof window !== 'undefined' && typeof (window as any).open === 'function') {
      printWindow = (window as any).open('', '_blank');
      if (printWindow && printWindow.document) usedWindow = true;
      else printWindow = null;
    }
  } catch { printWindow = null; }

  if (usedWindow && printWindow) {
    try {
      printWindow.document.open();
      printWindow.document.write(buildLoadingHtml(storeName));
      printWindow.document.close();
    } catch { /* noop */ }
  }

  const imageMap = await preloadImages(
    products,
    (done, total) => {
      emit({
        phase: 'downloading',
        done,
        total,
        message: `Optimizando imagen ${done} de ${total}…`,
      });
      try {
        if (usedWindow && printWindow && !printWindow.closed) {
          const el = printWindow.document.getElementById('status');
          if (el) el.textContent = `Optimizando imágenes… ${done}/${total}`;
        }
      } catch { /* noop */ }
    },
    cancelled
  );

  if (cancelled()) return;

  emit({ phase: 'building', done: 0, total: 0, message: 'Armando catálogo…' });
  const finalHtml = buildCatalogHtml(products, options, imageMap);

  if (usedWindow && printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(finalHtml);
      printWindow.document.close();
      emit({ phase: 'done', done: 0, total: 0, message: 'Listo' });
      return;
    } catch { /* noop */ }
  }

  emit({ phase: 'printing', done: 0, total: 0, message: 'Abriendo impresión…' });
  await printViaIframe(finalHtml);
  emit({ phase: 'done', done: 0, total: 0, message: 'Listo' });
};

// ==========================================
// Caché persistente por hash de URL
// ==========================================
const hashUrl = (url: string): string => {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
};

const getCacheDir = async (): Promise<string | null> => {
  try {
    const FileSystem: any = await import('expo-file-system/legacy');
    return FileSystem.cacheDirectory || FileSystem.documentDirectory || null;
  } catch {
    return null;
  }
};

const getCachedImagePath = (cacheDir: string, url: string): string => {
  const key = `${url}|${IMAGE_SETTINGS.maxWidth}|${IMAGE_SETTINGS.quality}`;
  return `${cacheDir}cat_cache_${hashUrl(key)}.jpg`;
};

/** Verifica si ya existe el caché comprimido y devuelve base64 si está disponible */
const readFromCache = async (cachePath: string): Promise<string | null> => {
  try {
    const FileSystem: any = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(cachePath);
    if (!info?.exists) return null;
    // Si el archivo está vacío o corrupto, forzar redescarga
    if (info.size && info.size < 100) return null;
    const base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: 'base64' });
    if (!base64) return null;
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
};

/** Borra todo el caché de imágenes de catálogo (útil para liberar espacio) */
export const clearCatalogImageCache = async (): Promise<void> => {
  try {
    const FileSystem: any = await import('expo-file-system/legacy');
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;

    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const catalogFiles = files.filter((f: string) => f.startsWith('cat_cache_'));

    await Promise.all(
      catalogFiles.map((f: string) =>
        FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true }).catch(() => { })
      )
    );

    console.log(`[Catalog] Caché limpiado: ${catalogFiles.length} archivos`);
  } catch (e) {
    console.warn('[Catalog] clearCatalogImageCache failed:', e);
  }
};
