import { Linking, Platform } from 'react-native';
import { Sale } from '../types/sale';
import { showAlert } from './alert';

/**
 * Genera el texto del comprobante para WhatsApp
 */
export const formatReceiptWhatsAppMessage = (
  sale: Sale,
  storeName: string = 'JD Store'
): string => {
  const dateStr = sale.createdAt?.toDate
    ? sale.createdAt.toDate().toLocaleString('es-ES')
    : new Date().toLocaleString('es-ES');

  const receiptNum = sale.receiptNumber || (sale.id ? sale.id.slice(-6).toUpperCase() : '');

  let msg = `🧾 *COMPROBANTE DE COMPRA*\n`;
  msg += `🏢 *${storeName.toUpperCase()}*\n`;
  if (receiptNum) msg += `🔢 *Nº Factura:* #${receiptNum}\n`;
  msg += `📅 *Fecha:* ${dateStr}\n`;

  if (sale.customerName) {
    msg += `👤 *Cliente:* ${sale.customerName}\n`;
  }

  const paymentLabels: Record<string, string> = {
    pago_movil: 'Pago Móvil',
    efectivo: 'Efectivo',
    zelle: 'Zelle',
    tarjeta: 'Tarjeta / Punto',
    otro: 'Otro',
    mixto: 'Mixto',
    transferencia: 'Transferencia',
  };
  msg += `💳 *Método de Pago:* ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}\n`;

  // Notas del cliente / venta
  if (sale.notes && sale.notes.trim().length > 0) {
    msg += `📝 *Notas:* ${sale.notes.trim()}\n`;
  }

  msg += `----------------------------------------\n`;
  msg += `🛍️ *DETALLE DE PRENDAS:*\n\n`;

  sale.items.forEach((item, idx) => {
    msg += `${idx + 1}. *${item.brand} - ${item.name}*\n`;
    msg += `   • Color: ${item.color} | Talla: ${item.size}\n`;
    msg += `   • Cantidad: ${item.quantity} x $${item.unitPrice.toFixed(2)} = *$${item.totalPrice.toFixed(2)}*\n\n`;
  });

  msg += `----------------------------------------\n`;

  if (sale.discount && sale.discount !== 0) {
    const isPositive = sale.discount > 0;
    const label = isPositive ? 'Descuento' : 'Ajuste Combo';
    const sign = isPositive ? '-' : '+';
    msg += `🎁 *${label}:* ${sign}$${Math.abs(sale.discount).toFixed(2)}\n`;
  }

  msg += `💰 *TOTAL PAGADO:* *$${sale.total.toFixed(2)}*\n\n`;
  msg += `✨ _¡Gracias por tu compra! Conserva este comprobante para cualquier cambio o garantía._`;

  return msg;
};

/**
 * Abre WhatsApp con el mensaje del comprobante pre-cargado
 */
export const openWhatsAppReceipt = async (sale: Sale, phone: string, storeName: string = 'JD Store') => {
  if (!phone || phone.trim() === '') {
    showAlert('Atención', 'Debes ingresar el número de WhatsApp del cliente.');
    return;
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const receiptNum = sale.receiptNumber || sale.id?.slice(-6) || '';

  const itemsText = sale.items
    .map(i => `▫️ ${i.quantity}x ${i.name} ($${i.unitPrice.toFixed(2)})`)
    .join('\n');

  let text = `¡Hola! Gracias por tu compra en *${storeName}*.\n\n` +
    `*Nº de Recibo:* #${receiptNum}\n` +
    `*Método:* ${sale.paymentMethod}\n` +
    `*Total Pagado:* $${sale.total.toFixed(2)}\n\n` +
    `*Detalle:*\n${itemsText}\n\n`;

  // Notas del cliente / venta
  if (sale.notes && sale.notes.trim().length > 0) {
    text += `*Notas:* ${sale.notes.trim()}\n\n`;
  }

  text += `¡Esperamos verte pronto!`;

  const encodedText = encodeURIComponent(text);

  const url = Platform.OS === 'web'
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;

  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('WhatsApp no instalado', 'Por favor instala WhatsApp para enviar el recibo.');
      }
    }
  } catch (error) {
    console.error('Error abriendo WhatsApp:', error);
    showAlert('Error', 'Hubo un problema al intentar abrir WhatsApp.');
  }
};

/**
 * Genera e imprime el ticket HTML formateado para impresoras de recibo o PDF
 */
export const printReceiptHTML = (sale: Sale, storeName: string = 'JD Store') => {
  const dateStr = sale.createdAt?.toDate
    ? sale.createdAt.toDate().toLocaleString('es-ES')
    : new Date().toLocaleString('es-ES');

  const paymentLabels: Record<string, string> = {
    pago_movil: 'Pago Móvil',
    efectivo: 'Efectivo',
    binance: 'Binance',
    zelle: 'Zelle',
    mixto: 'Mixto',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta / Punto',
    otro: 'Otro',
  };

  const receiptNum = sale.receiptNumber || (sale.id ? sale.id.slice(-6).toUpperCase() : 'VENTA');

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante #${receiptNum}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Courier New', Courier, monospace, sans-serif; width: 280px; margin: 0 auto; padding: 10px; color: #000; background: #fff; font-size: 12px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .header { margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
    .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 10px; margin-top: 2px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 8px; margin: 8px 0; }
    .notes-label { font-weight: bold; font-size: 10px; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .notes-text { font-size: 11px; color: #78350f; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
    .table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    .table th { border-bottom: 1px solid #000; text-align: left; font-size: 11px; padding-bottom: 4px; }
    .table td { padding: 4px 0; font-size: 11px; vertical-align: top; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .discount-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #7c3aed; margin-bottom: 4px; }
    .total-box { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-top: 6px; }
    .footer { margin-top: 16px; font-size: 10px; text-align: center; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <div class="header text-center">
    <div class="title">${storeName}</div>
    <div class="subtitle">COMPROBANTE DIGITAL DE VENTA</div>
    <div class="subtitle bold">Nº: #${receiptNum}</div>
  </div>
  <div class="info-row"><span>Fecha:</span><span class="bold">${dateStr}</span></div>
  ${sale.customerName ? `<div class="info-row"><span>Cliente:</span><span class="bold">${sale.customerName}</span></div>` : ''}
  <div class="info-row"><span>Pago:</span><span class="bold">${paymentLabels[sale.paymentMethod] || sale.paymentMethod}</span></div>
  ${sale.notes && sale.notes.trim().length > 0 ? `
  <div class="notes-box">
    <div class="notes-label">Notas</div>
    <div class="notes-text">${sale.notes.trim()}</div>
  </div>
  ` : ''}
  <div class="divider"></div>
  <table class="table">
    <thead>
      <tr><th>Cant / Desc.</th><th class="text-right">Total</th></tr>
    </thead>
    <tbody>
      ${sale.items.map((item) => `
        <tr>
          <td>
            <div class="bold">${item.brand} - ${item.name}</div>
            <div>${item.color} | Talla: ${item.size}</div>
            <div>${item.quantity} x $${item.unitPrice.toFixed(2)}</div>
          </td>
          <td class="text-right bold">$${item.totalPrice.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="divider"></div>
  ${sale.discount && sale.discount !== 0 ? `
  <div class="discount-row">
    <span>${sale.discount > 0 ? 'Descuento' : 'Ajuste Combo'}:</span>
    <span>${sale.discount > 0 ? '-' : '+'}$${Math.abs(sale.discount).toFixed(2)}</span>
  </div>
  ` : ''}
  <div class="total-box"><span>TOTAL:</span><span>$${sale.total.toFixed(2)}</span></div>
  <div class="footer">¡Gracias por tu preferencia!<br>Conserva este ticket para cualquier cambio.</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
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
    alert('Habilita las ventanas emergentes para imprimir el comprobante.');
  }
};
