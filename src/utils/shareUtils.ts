import { Linking, Platform } from 'react-native';
import { Product } from '../types/inventory';

/**
 * Formatea la ficha técnica de la prenda para WhatsApp con emojis y stock disponible
 */
export const formatProductWhatsAppMessage = (
  product: Product,
  selectedColor?: string
): string => {
  let message = `🛍️ *${product.brand.toUpperCase()} - ${product.name}*\n`;
  message += `📌 *Código:* ${product.code}\n`;
  message += `💵 *Precio:* $${product.price.toFixed(2)}\n\n`;

  message += `🎨 *Tallas y Colores Disponibles:*\n`;

  const variantsToInclude = selectedColor
    ? product.variants.filter((v) => v.color.toLowerCase() === selectedColor.toLowerCase())
    : product.variants;

  variantsToInclude.forEach((v) => {
    const availableSizes = (v.sizes || [])
      .filter((s) => Number(s.stock) > 0)
      .map((s) => `${s.size}`)
      .join(', ');

    if (availableSizes) {
      message += `• *Color ${v.color}:* Tallas ${availableSizes}\n`;
    } else {
      message += `• *Color ${v.color}:* (Agotado temporalmente)\n`;
    }
  });

  if (product.images && product.images.length > 0) {
    message += `\n🖼️ *Ver fotos HD:*\n`;
    product.images.slice(0, 2).forEach((img, idx) => {
      message += `Foto ${idx + 1}: ${img}\n`;
    });
  }

  message += `\n_¿Deseas apartar o consultar sobre este modelo?_`;
  return message;
};

/**
 * Abre WhatsApp con el mensaje pre-cargado
 */
export const openWhatsAppShare = (
  product: Product,
  phoneNumber?: string,
  selectedColor?: string
) => {
  const text = formatProductWhatsAppMessage(product, selectedColor);
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : '';

  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch(() => {
      alert('No se pudo abrir la aplicación de WhatsApp.');
    });
  }
};

/**
 * Descarga una foto al almacenamiento local del dispositivo
 */
export const downloadImageLocal = async (imageUrl: string, fileName?: string) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || `prenda-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    // Fallback directo abriendo en nueva pestaña si hay restricción de CORS
    window.open(imageUrl, '_blank');
  }
};
