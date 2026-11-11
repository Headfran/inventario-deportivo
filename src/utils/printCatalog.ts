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
// Config
// ==========================================
const IMAGE_MAX_WIDTH = 500;
const IMAGE_QUALITY = 0.75;
const IMAGE_TIMEOUT_MS = 5000;
const DOWNLOAD_CONCURRENCY = Platform.OS === 'web' ? 10 : 4;
const IMAGE_SETTINGS = Platform.OS === 'web'
  ? { maxWidth: 500, quality: 0.75 }
  : { maxWidth: 400, quality: 0.65 };

const COLOR_MAP: Record<string, string> = {
  'Negro': '#000000', 'Blanco': '#ffffff', 'Gris Oscuro': '#374151',
  'Gris': '#6b7280', 'Gris Claro': '#d1d5db', 'Marrón': '#8b4513',
  'Beige': '#d4b895', 'Rojo': '#ef4444', 'Azul Marino': '#1e3a8a',
  'Azul Rey': '#2563eb', 'Celeste': '#0ea5e9', 'Verde': '#16a34a',
  'Verde Aqua': '#20c997', 'Amarillo': '#eab308', 'Naranja': '#f97316',
  'Rosado': '#ec4899'
};

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f8fafc"/>
      <path d="M150 200 L250 200 M200 150 L200 250" stroke="#e2e8f0" stroke-width="2"/>
      <text x="200" y="280" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#cbd5e1" letter-spacing="2" text-anchor="middle">SIN FOTO</text>
    </svg>`
  );

// ==========================================
// Tamaños
// ==========================================
const SIZE_RANK: Record<string, number> = {
  'SS': -2, 'XXS': -2, 'XS': -1, 'S': 0, 'M': 1, 'L': 2, 'XL': 3,
  '2XL': 4, 'XXL': 4, '3XL': 5, 'XXXL': 5, '4XL': 6, '5XL': 7,
};

const sizeRank = (rawSize: any): number => {
  const s = String(rawSize ?? '').trim().toUpperCase();
  if (!s) return 5000;
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
// Concurrencia
// ==========================================
const runWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, shouldCancel?: () => boolean): Promise<(R | null)[]> => {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (shouldCancel?.()) return;
      const i = cursor++;
      if (i >= items.length) return;
      try { results[i] = await fn(items[i]); } catch { results[i] = null; }
    }
  });
  await Promise.all(workers);
  return results;
};

const getBrowserDocument = (): Document | null => (typeof window !== 'undefined' && (window as any).document) ? (window as any).document : null;
const getHTMLImageCtor = (): any => (typeof window !== 'undefined' && (window as any).Image) ? (window as any).Image : null;

const compressImageWeb = (url: string, maxWidth = IMAGE_MAX_WIDTH, quality = IMAGE_QUALITY, timeoutMs = IMAGE_TIMEOUT_MS): Promise<string> => {
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
        const ratio = Math.min(1, maxWidth / nw);
        canvas.width = Math.max(1, Math.round(nw * ratio));
        canvas.height = Math.max(1, Math.round(nh * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(url);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', quality));
      } catch { done(url); }
    };
    img.onerror = () => done(FALLBACK_IMAGE);
    setTimeout(() => done(url), timeoutMs);
    try { img.src = url; } catch { done(url); }
  });
};

const compressImageNative = async (url: string): Promise<string | null> => {
  return Promise.race([
    (async () => {
      try {
        const FileSystem: any = await import('expo-file-system/legacy');
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) return null;
        const cachePath = `${cacheDir}cat_cache_${hashUrl(url)}.jpg`;
        const info = await FileSystem.getInfoAsync(cachePath);
        if (info.exists && info.size > 100) {
          const base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: 'base64' });
          return `data:image/jpeg;base64,${base64}`;
        }
        const tempUri = `${cacheDir}tmp_${Date.now()}.jpg`;
        await FileSystem.downloadAsync(url, tempUri);

        let ImageManipulator: any;
        try { ImageManipulator = await import('expo-image-manipulator'); } catch { }

        if (ImageManipulator?.manipulateAsync) {
          const result = await ImageManipulator.manipulateAsync(tempUri, [{ resize: { width: IMAGE_SETTINGS.maxWidth } }], { compress: IMAGE_SETTINGS.quality, format: 'jpeg', base64: true });
          FileSystem.copyAsync({ from: result.uri, to: cachePath }).catch(() => { });
          FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => { });
          return `data:image/jpeg;base64,${result.base64}`;
        }

        const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: 'base64' });
        FileSystem.copyAsync({ from: tempUri, to: cachePath }).catch(() => { });
        return `data:image/jpeg;base64,${base64}`;
      } catch { return null; }
    })(),
    new Promise<string | null>((r) => setTimeout(() => r(null), 12000))
  ]);
};

// ==========================================
// HTML de carga (con barra + contador + timer propio)
// ==========================================
const buildLoadingHtml = (storeName: string): string => `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${storeName} — Generando</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#111;padding:24px;}
  .spinner{width:40px;height:40px;border:3px solid #eee;border-top-color:#111;border-radius:50%;animation:spin 0.8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  h1{font-size:14px;margin:20px 0 6px;letter-spacing:2px;text-transform:uppercase;font-weight:800;}
  p{margin:0;font-size:11px;color:#888;letter-spacing:1px;text-align:center;}
  #status{color:#111;font-weight:600;margin-bottom:8px;min-height:16px;}
  .bar{width:100%;max-width:320px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin:6px 0 8px;}
  #bar-fill{height:100%;background:#111;width:0%;border-radius:3px;transition:width 0.15s ease;}
  .meta{display:flex;justify-content:space-between;align-items:center;width:100%;max-width:320px;font-size:10px;color:#666;font-variant-numeric:tabular-nums;margin-top:4px;}
  #counter{font-weight:600;}
  #timer{font-weight:600;color:#111;}
  #hint{margin-top:14px;font-size:10px;color:#999;font-style:italic;text-align:center;max-width:320px;}
</style>
</head>
<body>
  <div class="spinner"></div>
  <h1>Construyendo Catálogo</h1>
  <p id="status">Preparando…</p>
  <div class="bar"><div id="bar-fill"></div></div>
  <div class="meta">
    <span id="counter">Iniciando…</span>
    <span id="timer">0s</span>
  </div>
  <p id="hint">Las fotos se están optimizando en paralelo. Esto puede tardar unos segundos…</p>
  <script>
    (function(){
      var start = Date.now();
      setInterval(function(){
        var s = Math.floor((Date.now() - start) / 1000);
        var display = s < 60 ? s + 's' : Math.floor(s/60) + 'm ' + (s%60) + 's';
        var el = document.getElementById('timer');
        if (el) el.textContent = display;
      }, 500);
    })();
  </script>
</body></html>`;

// Actualiza la loading page con progreso real
const updateLoadingWindow = (win: any, progress: CatalogPrintProgress): void => {
  if (!win || win.closed) return;
  try {
    const doc = win.document;
    if (!doc) return;
    const statusEl = doc.getElementById('status');
    const counterEl = doc.getElementById('counter');
    const barEl = doc.getElementById('bar-fill');
    const hintEl = doc.getElementById('hint');

    if (statusEl && progress.message) statusEl.textContent = progress.message;

    if (progress.total > 0) {
      const pct = Math.min(100, Math.round((progress.done / progress.total) * 100));
      if (counterEl) counterEl.textContent = progress.done + ' / ' + progress.total + ' (' + pct + '%)';
      if (barEl) barEl.style.width = pct + '%';
      if (hintEl) hintEl.textContent = 'Optimizando y descargando fotos…';
    }

    if (progress.phase === 'building') {
      if (counterEl) counterEl.textContent = 'Armando cuadrícula…';
      if (barEl) barEl.style.width = '100%';
      if (hintEl) hintEl.textContent = 'Escribiendo el documento final…';
    }
    if (progress.phase === 'done') {
      if (counterEl) counterEl.textContent = '¡Listo!';
      if (hintEl) hintEl.textContent = 'El catálogo se está abriendo.';
    }
  } catch { /* window puede estar cerrada o cross-origin */ }
};

// ==========================================
// Catálogo HTML 
// ==========================================
const buildCatalogHtml = (products: Product[], options: CatalogPrintOptions, imageMap: Map<string, string>): string => {
  const { showPrices, storeName = 'Catálogo', categoryFilterName, subtitle } = options;
  const currentDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  // ==========================================
  // Render de una card individual
  // ==========================================
  const renderCard = (p: Product): string => {
    const img1 = p.images?.[0] ? (imageMap.get(p.images[0]) || FALLBACK_IMAGE) : FALLBACK_IMAGE;
    const img2 = p.images?.[1] ? (imageMap.get(p.images[1]) || null) : null;

    const imagesMarkup = img2
      ? `<div class="img-wrap dual-img"><img src="${img1}" class="img-left"/><img src="${img2}" class="img-right"/></div>`
      : `<div class="img-wrap single-img"><img src="${img1}" /></div>`;

    const variantsMarkup = (p.variants || [])
      .filter((v: any) => (v.sizes || []).some((s: any) => Number(s.stock) > 0))
      .map((v: any) => {
        const availableSizes = sortSizes((v.sizes || []).filter((s: any) => Number(s.stock) > 0).map((s: any) => String(s.size))).join(' <span class="sep">|</span> ');
        const fallbackHex = COLOR_MAP[v.color] || v.colorHex || '#cbd5e1';

        return `
      <div class="variant-row">
        <div class="color-circle" style="background-color: ${fallbackHex};"></div>
        <div class="variant-info">
          <span class="color-name">${v.color || 'Único'}</span>
          <div class="leader"></div>
          <span class="sizes">${availableSizes}</span>
        </div>
      </div>`;
      }).join('');

    return `
    <div class="card">
      <div class="image-container">
        ${imagesMarkup}
        <div class="brand-badge">${p.brand || 'EXCLUSIVE'}</div>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <h2 class="card-name">${p.name || 'Sin Nombre'}</h2>
          <span class="card-code">${p.code || 'N/A'}</span>
        </div>
        <div class="variants-container">
          ${variantsMarkup}
        </div>
      </div>
      ${showPrices ? `<div class="card-price">$${Number(p.price || 0).toFixed(2)}</div>` : ''}
    </div>`;
  };

  // ==========================================
  // PRE-PAGINACIÓN: 6 cards por página (3 columnas × 2 filas)
  // Reduce a 6 para dar 60mm de margen de seguridad a A4
  // ==========================================
  const ITEMS_PER_PAGE = 6;
  const pages: Product[][] = [];
  for (let i = 0; i < products.length; i += ITEMS_PER_PAGE) {
    pages.push(products.slice(i, i + ITEMS_PER_PAGE));
  }

  const totalPages = pages.length;

  const renderHeader = (pageNum: number, isFirst: boolean) => {
    if (isFirst) {
      return `
        <header class="sheet-header sheet-header-main">
          <div>
            <img src="/logo.png" class="logo-img" alt="" onerror="this.style.display='none'; document.getElementById('text-logo').style.display='block';" />
            <h1 id="text-logo" class="store-title" style="display:none;">${storeName}</h1>
            <p class="store-subtitle">${categoryFilterName ? `${categoryFilterName} • ` : ''}${subtitle || 'Lookbook Oficial'}</p>
          </div>
          <div class="header-right">
            ${currentDate}<br/>${products.length} Referencias
          </div>
        </header>`;
    }
    return `
      <header class="sheet-header sheet-header-compact">
        <div class="compact-brand">${storeName}</div>
        <div class="compact-page">Página ${pageNum} / ${totalPages}</div>
      </header>`;
  };

  const renderFooter = (isLast: boolean) => {
    if (isLast) {
      return `
        <footer class="sheet-footer sheet-footer-main">
          Colección sujeta a disponibilidad • Diseñado para ${storeName}
        </footer>`;
    }
    return `<footer class="sheet-footer sheet-footer-mini">&nbsp;</footer>`;
  };

  const pagesMarkup = pages.length > 0
    ? pages.map((group, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === pages.length - 1;
      return `
          <div class="sheet">
            ${renderHeader(idx + 1, isFirst)}
            <div class="grid">
              ${group.map(renderCard).join('')}
            </div>
            ${renderFooter(isLast)}
          </div>`;
    }).join('')
    : `<div class="sheet"><p style="text-align:center;color:#94a3b8;font-style:italic;padding:40px;">No hay prendas con stock disponible para esta selección.</p></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${storeName} — Lookbook</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }

    .toolbar {
      position: fixed;
      top: 15px;
      right: 15px;
      display: flex;
      gap: 8px;
      z-index: 9999;
    }
    .toolbar button {
      padding: 10px 16px;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #fff;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    .toolbar button.primary { background: #0f172a; color: #fff; border: none; }

    /* ============================================
       HOJA (página = 1 sheet)
       Dimensiones A4 explícitas en mm. El padding
       interno de 8mm es equivalente al @page margin
       pero explícito para que Safari no lo ignore.
       ============================================ */
    .sheet {
      position: relative;
      width: 210mm;
      height: 297mm;
      padding: 8mm;
      margin: 0;
      background: #ffffff;
      overflow: hidden;
      /* Salto de página entre sheets — declarado aquí, en un div de bloque (NO flex) */
      page-break-after: always;
      break-after: page;
      /* Contener todo dentro de la hoja físicamente */
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* ============================================
       HEADER (bloque normal, sin flex anidado conflictivo)
       ============================================ */
    .sheet-header {
      width: 100%;
      height: 22mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 2mm;
      margin-bottom: 4mm;
      /* No separar del contenido siguiente */
      page-break-after: avoid;
      break-after: avoid;
    }
    .sheet-header-compact {
      height: 8mm;
      align-items: center;
      border-bottom-width: 1px;
      margin-bottom: 3mm;
    }
    .logo-img { max-height: 10mm; margin-bottom: 1mm; object-fit: contain; }
    .store-title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; color: #0f172a; }
    .store-subtitle { font-size: 10px; font-weight: 500; color: #64748b; margin: 1mm 0 0; text-transform: uppercase; letter-spacing: 1px; }
    .header-right { text-align: right; font-size: 9px; font-weight: 600; color: #475569; text-transform: uppercase; }
    .compact-brand { font-size: 9px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
    .compact-page { font-size: 8px; font-weight: 600; color: #64748b; }

    /* ============================================
       GRID DE CARDS: 3 columnas × 2 filas
       display: block + inline-block (NO flex) para que Safari respete page-break-inside
       font-size: 0 para eliminar el espacio entre inline-blocks
       ============================================ */
    .grid {
      display: block;
      font-size: 0;
      width: 100%;
      height: auto;
    }
    .grid > .card {
      display: inline-block;
      vertical-align: top;
      width: calc((100% - 8mm) / 3);
      margin-right: 4mm;
      margin-bottom: 4mm;
      font-size: 12px;
    }
    .grid > .card:nth-child(3n) {
      margin-right: 0;
    }

    /* ============================================
       CARD — altura fija, protegida contra cortes
       ============================================ */
    .card {
      height: 88mm;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      /* 3 prefijos para máxima compatibilidad */
      page-break-inside: avoid !important;
      -webkit-column-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* IMAGEN */
    .image-container {
      height: 45mm;
      width: 100%;
      flex-shrink: 0;
      position: relative;
      border-bottom: 1px solid #e2e8f0;
      background-color: #f8fafc;
    }
    .img-wrap { width: 100%; height: 100%; display: flex; padding: 1mm; gap: 1mm; }
    .img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 3px;
    }
    .dual-img img { width: 50%; background: #ffffff; }

    .brand-badge {
      position: absolute;
      bottom: 1.5mm;
      left: 1.5mm;
      background: #0f172a;
      color: #fff;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 0.5mm 1.5mm;
      border-radius: 3px;
    }

    /* CUERPO */
    .card-body {
      padding: 2mm 2.5mm;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .card-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-shrink: 0;
      margin-bottom: 1mm;
      gap: 1mm;
    }
    .card-name {
      font-size: 11px;
      font-weight: 800;
      margin: 0;
      color: #0f172a;
      line-height: 1.15;
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .card-code {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      padding: 1px 3px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .variants-container {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 1mm;
      overflow: hidden;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 3px;
      padding: 1.5mm 2mm;
      justify-content: center;
    }
    .variant-row { display: flex; align-items: center; width: 100%; }
    .color-circle {
      width: 2.5mm;
      height: 2.5mm;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.15);
      flex-shrink: 0;
      margin-right: 1.5mm;
    }
    .variant-info { display: flex; align-items: center; gap: 1mm; flex: 1; overflow: hidden; }
    .color-name { font-size: 9px; font-weight: 700; color: #334155; white-space: nowrap; line-height: 1; }
    .leader { flex: 1; border-bottom: 1px dotted #94a3b8; margin: 0 1mm; opacity: 0.5; }
    .sizes { font-size: 8px; font-weight: 700; color: #059669; white-space: nowrap; line-height: 1; }
    .sep { color: #cbd5e1; font-weight: 400; margin: 0 1px; }

    /* PRECIO */
    .card-price {
      height: 8mm;
      flex-shrink: 0;
      background: #ffffff;
      padding: 1.5mm 2.5mm;
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-align: right;
      border-top: 1px dashed #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    /* ============================================
       FOOTER — dentro del sheet, empujado abajo con padding
       ============================================ */
    .sheet-footer {
      position: absolute;
      left: 8mm;
      right: 8mm;
      bottom: 8mm;
      border-top: 1px solid #e2e8f0;
      padding-top: 2mm;
      font-size: 8px;
      font-weight: 500;
      color: #94a3b8;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .sheet-footer-mini {
      border-top: none;
      padding-top: 0;
      height: 4mm;
    }

    /* ============================================
       PRINT
       ============================================ */
    @media print {
      .toolbar { display: none !important; }
      .sheet {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 8mm;
        box-shadow: none;
      }
      .grid > .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()" class="primary">Guardar PDF</button>
    <button onclick="window.close()">Cerrar</button>
  </div>

  ${pagesMarkup}

  <script>
    (function(){
      function doPrint(){ try{ window.print(); }catch(e){} }
      window.onload = function() {
        var imgs = Array.from(document.images);
        if(!imgs.length) { setTimeout(doPrint, 500); return; }
        var loaded = 0;
        imgs.forEach(function(i){
          if(i.complete) { loaded++; if(loaded === imgs.length) setTimeout(doPrint, 500); }
          else {
            i.onload = i.onerror = function(){
              loaded++;
              if(loaded === imgs.length) setTimeout(doPrint, 500);
            };
          }
        });
      };
    })();
  </script>
</body>
</html>`;
};

// ==========================================
// EXPORTADOR PRINCIPAL
// ==========================================
export const generateCatalogPrint = async (
  products: Product[],
  options: CatalogPrintOptions,
  handlers?: CatalogPrintHandlers
): Promise<void> => {
  // Ref mutable a la loading window (web) para actualizarla en cada emit
  let loadingWinRef: any = null;

  const emit = (p: CatalogPrintProgress) => {
    try { handlers?.onProgress?.(p); } catch { }
    try { updateLoadingWindow(loadingWinRef, p); } catch { }
  };
  const cancelled = () => !!handlers?.shouldCancel?.();

  // Filtro estricto: solo variantes con ubicaciones
  const validProducts = products.reduce((acc: Product[], p) => {
    const variantsWithStock = (p.variants || []).filter(v =>
      (v.sizes || []).some(s => Number(s.stock) > 0)
    );
    if (variantsWithStock.length > 0) {
      acc.push({ ...p, variants: variantsWithStock });
    }
    return acc;
  }, []);

  const storeName = options?.storeName || 'Catálogo';

  // ==========================================
  // NATIVE
  // ==========================================
  if (Platform.OS !== 'web') {
    const urlsToDownload = new Set<string>();
    validProducts.forEach(p => {
      if (p.images?.[0]) urlsToDownload.add(p.images[0]);
      if (p.images?.[1]) urlsToDownload.add(p.images[1]);
    });
    const total = urlsToDownload.size;

    emit({ phase: 'downloading', done: 0, total, message: total > 0 ? `Preparando ${total} fotos…` : 'Preparando…' });

    let done = 0;
    const imageMap = new Map<string, string>();

    await runWithConcurrency(Array.from(urlsToDownload), DOWNLOAD_CONCURRENCY, async (url) => {
      if (cancelled()) return;
      const b64 = await compressImageNative(url) || url;
      imageMap.set(url, b64);
      done++;
      emit({ phase: 'downloading', done, total, message: `Optimizando foto ${done} de ${total}…` });
    }, cancelled);

    if (cancelled()) return;

    emit({ phase: 'building', done: total, total, message: 'Armando cuadrícula…' });
    const html = buildCatalogHtml(validProducts, options, imageMap);

    if (cancelled()) return;
    emit({ phase: 'printing', done: total, total, message: 'Abriendo archivo…' });

    const Print: any = await import('expo-print');
    const Sharing: any = await import('expo-sharing');
    const FileSystem: any = await import('expo-file-system/legacy');

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const safeUri = `${FileSystem.cacheDirectory}Inventario_${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: safeUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(safeUri, { mimeType: 'application/pdf', dialogTitle: 'Compartir Catálogo' });
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      await Print.printAsync({ html });
    }

    emit({ phase: 'done', done: total, total, message: 'Listo' });
    return;
  }

  // ==========================================
  // WEB
  // ==========================================
  emit({ phase: 'starting', done: 0, total: 0, message: 'Preparando…' });

  // Abrir la pestaña YA (gesto del usuario) y guardarla como ref para actualizarla
  let printWindow: any = null;
  try {
    printWindow = window.open('', '_blank');
    if (printWindow) {
      loadingWinRef = printWindow;
      printWindow.document.write(buildLoadingHtml(storeName));
      printWindow.document.close();
    }
  } catch { /* bloqueado por popup blocker */ }

  const urlsToDownload = new Set<string>();
  validProducts.forEach(p => {
    if (p.images?.[0]) urlsToDownload.add(p.images[0]);
    if (p.images?.[1]) urlsToDownload.add(p.images[1]);
  });
  const total = urlsToDownload.size;

  let done = 0;
  const imageMap = new Map<string, string>();

  emit({ phase: 'downloading', done: 0, total, message: `Optimizando 0 de ${total} fotos…` });

  await runWithConcurrency(Array.from(urlsToDownload), DOWNLOAD_CONCURRENCY, async (url) => {
    if (cancelled()) return;
    const b64 = await compressImageWeb(url);
    imageMap.set(url, b64);
    done++;
    emit({ phase: 'downloading', done, total, message: `Optimizando foto ${done} de ${total}…` });
  }, cancelled);

  if (cancelled()) {
    emit({ phase: 'done', done, total, message: 'Cancelado' });
    return;
  }

  emit({ phase: 'building', done: total, total, message: 'Armando catálogo…' });
  const html = buildCatalogHtml(validProducts, options, imageMap);

  if (printWindow && !printWindow.closed) {
    // Ya no necesitamos actualizar el status: vamos a escribir el HTML final
    loadingWinRef = null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  emit({ phase: 'done', done: total, total, message: 'Listo' });
};

const hashUrl = (url: string): string => {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export const clearCatalogImageCache = async (): Promise<void> => {
  try {
    const FileSystem: any = await import('expo-file-system/legacy');
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    await Promise.all(files.filter((f: string) => f.startsWith('cat_cache_')).map((f: string) => FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true }).catch(() => { })));
  } catch { }
};
