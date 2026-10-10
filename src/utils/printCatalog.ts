import { Product } from '../types/inventory';

export interface CatalogPrintOptions {
  showPrices: boolean;
  storeName?: string;
  categoryFilterName?: string;
  subtitle?: string;
}

/**
 * Genera el documento HTML formateado para impresión/exportación a PDF
 * con desglose detallado de Tallas por Color.
 */
export const generateCatalogPrint = (
  products: Product[],
  options: CatalogPrintOptions
) => {
  const {
    showPrices,
    storeName = 'Catálogo de Prendas',
    categoryFilterName,
    subtitle,
  } = options;

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${storeName} - Catálogo</title>
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #1e3a8a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .meta-info {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      box-sizing: border-box;
      page-break-inside: avoid;
      background-color: #ffffff;
      display: flex;
      flex-direction: column;
    }
    .img-container {
      width: 100%;
      height: 150px;
      border-radius: 6px;
      overflow: hidden;
      background-color: #f8fafc;
      margin-bottom: 8px;
      text-align: center;
    }
    .img-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .card-brand {
      font-size: 10px;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin: 2px 0;
    }
    .card-code {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .variants-container {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      margin-top: 4px;
      font-size: 10px;
      color: #334155;
    }
    .variant-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .variant-row:last-child {
      border-bottom: none;
    }
    .color-label {
      font-weight: 700;
      color: #1e293b;
    }
    .sizes-label {
      color: #059669;
      font-weight: 600;
    }
    .out-of-stock {
      color: #ef4444;
      font-style: italic;
    }
    .price-tag {
      font-size: 14px;
      font-weight: 800;
      color: #16a34a;
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px solid #f1f5f9;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">${storeName}</h1>
      <p class="subtitle">
        ${categoryFilterName ? `Categoría: ${categoryFilterName} • ` : ''}
        ${subtitle || `Total prendas: ${products.length}`}
      </p>
    </div>
    <div class="meta-info">
      <div><strong>Fecha de emisión:</strong> ${currentDate}</div>
      <div><strong>Modalidad:</strong> ${showPrices ? 'Con Precios de Venta' : 'Solo Exhibición (Sin Precios)'}</div>
    </div>
  </div>

  <div class="grid">
    ${products
      .map((p) => {
        const coverImg = p.images?.[0] || 'https://via.placeholder.com/200?text=Sin+Foto';

        // Desglose de cada color con sus tallas disponibles
        const variantsMarkup = (p.variants || [])
          .map((v) => {
            const availableSizes = (v.sizes || [])
              .filter((s) => Number(s.stock) > 0)
              .map((s) => s.size)
              .join(', ');

            return `
              <div class="variant-row">
                <span class="color-label">• ${v.color}:</span>
                <span class="${availableSizes ? 'sizes-label' : 'out-of-stock'}">
                  ${availableSizes ? `Tallas: ${availableSizes}` : 'Agotado'}
                </span>
              </div>
            `;
          })
          .join('');

        return `
      <div class="card">
        <div class="img-container">
          <img src="${coverImg}" alt="${p.name}" />
        </div>
        <div class="card-brand">${p.brand}</div>
        <div class="card-name">${p.name}</div>
        <div class="card-code">SKU: ${p.code}</div>

        <div class="variants-container">
          ${variantsMarkup || '<div class="variant-row">Sin variantes</div>'}
        </div>

        ${showPrices ? `<div class="price-tag">$${p.price.toFixed(2)}</div>` : ''}
      </div>
    `;
      })
      .join('')}
  </div>

  <div class="footer">
    Documento generado automáticamente por el Sistema de Inventario. Precios y disponibilidad sujetos a cambio sin previo aviso.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert('Por favor habilita las ventanas emergentes (pop-ups) para generar el catálogo imprimible.');
  }
};
