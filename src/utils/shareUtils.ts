import { Linking, Platform, Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Product } from '../types/inventory';

// ==========================================
// ORDEN INTELIGENTE DE TALLAS
// ==========================================
const sortSizes = (sizes: string[]): string[] => {
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  return sizes.sort((a, b) => {
    const indexA = SIZE_ORDER.indexOf(a.toUpperCase());
    const indexB = SIZE_ORDER.indexOf(b.toUpperCase());

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;

    return a.localeCompare(b);
  });
};

// ==========================================
// FORMATEO DE TEXTO
// ==========================================
export const formatProductShareText = (product: Product, selectedColors: string[] = []): string => {
  let msg = `📌 *Código:* ${product.code}\n\n`;

  const variants = selectedColors.length > 0
    ? product.variants.filter((v) => selectedColors.includes(v.color))
    : product.variants;

  variants.forEach((v) => {
    const availableSizes = (v.sizes || []).filter((s) => Number(s.stock) > 0).map((s) => s.size);
    const sortedSizes = sortSizes(availableSizes).join(', ');

    msg += sortedSizes ? `• *${v.color}:* ${sortedSizes}\n` : `• *${v.color}:* (Agotado)\n`;
  });

  return msg.trim();
};

export const formatBulkShareText = (products: Product[]): string => {
  let msg = ``;
  products.forEach(p => {
    msg += `📌 *Código:* ${p.code}\n`;
    const availableSizes = Array.from(new Set(p.variants.flatMap(v => v.sizes.filter(s => s.stock > 0).map(s => s.size))));
    const sortedSizes = sortSizes(availableSizes).join(', ');
    msg += `• Tallas: ${sortedSizes || '(Agotado)'}\n\n`;
  });
  return msg.trim();
};

// ==========================================
// CONVERSIÓN A FILE (para Web Share API)
// ==========================================
const imageUrlToFile = async (url: string, fallbackName: string): Promise<File> => {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`No se pudo descargar la imagen (${response.status})`);

  const blob = await response.blob();
  const mime = blob.type || 'image/jpeg';

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
  };
  const ext = extMap[mime] || 'jpg';
  const baseName = fallbackName.replace(/\.[^.]+$/, '');

  return new File([blob], `${baseName}.${ext}`, { type: mime });
};

// ==========================================
// DESCARGA LOCAL (Web + Native)
// ==========================================
export const downloadImageLocal = async (url: string, filename: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } else {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) throw new Error('No hay directorio disponible');
      await FileSystem.downloadAsync(url, `${baseDir}${filename}`);
    }
  } catch (e) {
    console.error('Error descargando imagen:', e);
  }
};

// ==========================================
// CACHÉ LOCAL (Native)
// ==========================================
const ensureImageCached = async (imageUrl: string, uniqueId: string, onStatus?: (s: string) => void): Promise<string> => {
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Sistema de archivos inalcanzable');

  const imageHash = imageUrl.substring(imageUrl.length - 15).replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `img_cache_${uniqueId.replace(/[^a-zA-Z0-9]/g, '_')}_${imageHash}.jpg`;
  const localUri = `${baseDir}${fileName}`;

  if (onStatus) onStatus('Verificando caché local... 🔍');
  const info = await FileSystem.getInfoAsync(localUri);

  if (info.exists) {
    if (onStatus) onStatus('Usando imagen guardada ⚡');
    return localUri;
  }

  if (onStatus) onStatus('Descargando alta calidad... 📥');
  const { uri } = await FileSystem.downloadAsync(imageUrl, localUri);
  return uri;
};

// ==========================================
// COMPARTIR UN PRODUCTO
// ==========================================
export const advancedNativeShare = async (
  product: Product,
  selectedColors: string[] = [],
  selectedImage?: string,
  onStatus?: (s: string | null) => void
) => {
  const text = formatProductShareText(product, selectedColors);
  const targetImage = selectedImage || (product.images && product.images[0]);

  try {
    // ==========================================
    // WEB PWA
    // ==========================================
    if (Platform.OS === 'web') {
      // ---- 1. Intentar Web Share API CON archivo ----
      if (targetImage && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          if (onStatus) onStatus('Preparando imagen...');
          const file = await imageUrlToFile(targetImage, `${product.code || 'producto'}.jpg`);

          if (navigator.canShare({ files: [file] })) {
            if (onStatus) onStatus('Abriendo menú de compartir...');
            await navigator.share({
              title: product.code || 'Producto',
              text: text,
              files: [file],
            });
            if (onStatus) onStatus(null);
            return;
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            if (onStatus) onStatus(null);
            return;
          }
          console.warn('Web Share con archivo falló, usando fallback:', e);
        }
      }

      // ---- 2. Intentar Web Share API SOLO texto (si el navegador no admite files) ----
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          if (onStatus) onStatus('Abriendo menú de compartir...');
          await navigator.share({ title: product.code || 'Producto', text });
          if (onStatus) onStatus(null);
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') {
            if (onStatus) onStatus(null);
            return;
          }
          // Sigue al fallback
        }
      }

      // ---- 3. Fallback definitivo: descargar imagen + copiar texto ----
      if (onStatus) onStatus('Descargando imagen...');
      if (targetImage) {
        await downloadImageLocal(
          targetImage,
          `${(product.code || 'producto').replace(/\s+/g, '_')}_foto.jpg`
        );
      }

      if (onStatus) onStatus('Copiando texto...');
      await Clipboard.setStringAsync(text);
      if (onStatus) onStatus(null);

      const msg =
        '✅ Imagen descargada y texto copiado.\n\n' +
        'Abre WhatsApp, adjunta la imagen desde tu galería/descargas y pega el texto en el chat.';
      window.alert(msg);
      return;
    }

    // ==========================================
    // NATIVE (App / Expo Go)
    // ==========================================
    if (targetImage) {
      if (onStatus) onStatus('Copiando detalles... 📋');
      await Clipboard.setStringAsync(text);

      const localUri = await ensureImageCached(targetImage, product.code || 'prenda', onStatus);

      if (onStatus) onStatus('Abriendo menú de compartir... 🚀');
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          '¡Texto Copiado!',
          'La información se copió al portapapeles.\n\nAl abrir WhatsApp o Instagram, presiona en el cuadro de texto y dale a "Pegar".',
          [
            {
              text: 'Compartir Imagen',
              onPress: async () => {
                if (onStatus) onStatus(null);
                await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
              },
            },
          ]
        );
      } else {
        if (onStatus) onStatus(null);
        await Share.share({ message: text });
      }
    } else {
      if (onStatus) onStatus(null);
      await Share.share({ message: text });
    }
  } catch (error) {
    console.error('Error sharing', error);
    if (onStatus) onStatus(null);
  }
};

// ==========================================
// COMPARTIR EN WHATSAPP (SOLO TEXTO)
// ==========================================
export const openWhatsAppShare = async (
  product: Product,
  phone?: string,
  selectedColors: string[] = []
): Promise<void> => {
  const text = formatProductShareText(product, selectedColors);
  const cleanPhone = (phone || '').replace(/[^\d]/g, '');
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  try {
    await Linking.openURL(url);
  } catch (e) {
    console.error('Error abriendo WhatsApp:', e);
    Alert.alert('Error', 'No se pudo abrir WhatsApp.');
  }
};

// ==========================================
// COMPARTIR MÚLTIPLES PRODUCTOS (bulk)
// ==========================================
export const advancedBulkNativeShare = async (products: Product[], onStatus?: (s: string | null) => void) => {
  const text = formatBulkShareText(products);
  try {
    if (Platform.OS === 'web') {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Catálogo', text });
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }

      await Clipboard.setStringAsync(text);
      window.alert('Catálogo copiado al portapapeles');
      return;
    }

    const firstImageProduct = products.find(p => p.images && p.images.length > 0);

    if (firstImageProduct) {
      if (onStatus) onStatus('Preparando catálogo... 📋');
      await Clipboard.setStringAsync(text);

      const localUri = await ensureImageCached(firstImageProduct.images[0], 'bulk_cover', onStatus);

      if (onStatus) onStatus('Abriendo sistema... 🚀');
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          '¡Catálogo Copiado!',
          'El texto del catálogo se copió.\n\nComparte esta portada y pega el texto en tu chat.',
          [
            {
              text: 'Continuar',
              onPress: async () => {
                if (onStatus) onStatus(null);
                await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
              },
            },
          ]
        );
        return;
      }
    }
    if (onStatus) onStatus(null);
    await Share.share({ message: text });
  } catch (error) {
    console.error('Error bulk', error);
    if (onStatus) onStatus(null);
  }
};
