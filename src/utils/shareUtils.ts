import { Linking, Platform, Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Product } from '../types/inventory';

export const formatProductShareText = (product: Product, selectedColor?: string): string => {
  let msg = `🛍️ *${product.brand.toUpperCase()} - ${product.name}*\n📌 *Código:* ${product.code}\n💵 *Precio:* $${product.price.toFixed(2)}\n\n🎨 *Tallas Disponibles:*\n`;
  const variants = selectedColor ? product.variants.filter((v) => v.color.toLowerCase() === selectedColor.toLowerCase()) : product.variants;
  variants.forEach((v) => {
    const sizes = (v.sizes || []).filter((s) => Number(s.stock) > 0).map((s) => s.size).join(', ');
    msg += sizes ? `• *${v.color}:* ${sizes}\n` : `• *${v.color}:* (Agotado)\n`;
  });
  return msg + `\n_¿Deseas apartar o consultar sobre este modelo?_`;
};

export const formatBulkShareText = (products: Product[]): string => {
  let msg = `🌟 *CATÁLOGO DISPONIBLE* 🌟\n\n`;
  products.forEach(p => {
    msg += `🛍️ *${p.brand} - ${p.name}*\n`;
    msg += `📌 Código: ${p.code} | 💵 $${p.price.toFixed(2)}\n`;
    const availableSizes = Array.from(new Set(p.variants.flatMap(v => v.sizes.filter(s => s.stock > 0).map(s => s.size)))).join(', ');
    msg += `📏 Tallas: ${availableSizes || '(Agotado)'}\n\n`;
  });
  return msg + `_¿Te interesa alguno de estos modelos?_`;
};

// MOTOR DE CACHÉ INTELIGENTE
const ensureImageCached = async (imageUrl: string, productCode: string, onStatus?: (s: string) => void): Promise<string> => {
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Sistema de archivos inalcanzable');

  // Formateamos un nombre único basado en el código del producto
  const fileName = `img_cache_${productCode.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
  const localUri = `${baseDir}${fileName}`;

  // Verificamos si la imagen ya existe físicamente en el celular
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

export const advancedNativeShare = async (product: Product, selectedColor?: string, onStatus?: (s: string | null) => void) => {
  const text = formatProductShareText(product, selectedColor);

  try {
    if (Platform.OS === 'web') {
      if (onStatus) onStatus('Generando enlace...');
      await Clipboard.setStringAsync(text);
      alert('Texto copiado al portapapeles');
      if (onStatus) onStatus(null);
      return;
    }

    if (product.images && product.images.length > 0) {
      if (onStatus) onStatus('Copiando detalles... 📋');
      await Clipboard.setStringAsync(text);

      const localUri = await ensureImageCached(product.images[0], product.code || 'prenda', onStatus);

      if (onStatus) onStatus('Abriendo menú de compartir... 🚀');
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          '¡Texto Copiado!',
          'La información se copió al portapapeles.\n\nAl abrir WhatsApp/Instagram, presiona en el cuadro de texto y dale a "Pegar".',
          [{
            text: 'Compartir Imagen',
            onPress: async () => {
              if (onStatus) onStatus(null);
              await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
            }
          }]
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

export const advancedBulkNativeShare = async (products: Product[], onStatus?: (s: string | null) => void) => {
  const text = formatBulkShareText(products);
  try {
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(text);
      alert('Catálogo copiado al portapapeles');
      return;
    }

    const firstImageProduct = products.find(p => p.images && p.images.length > 0);

    if (firstImageProduct) {
      if (onStatus) onStatus('Preparando catálogo... 📋');
      await Clipboard.setStringAsync(text);

      // Descargamos o usamos el caché de la portada
      const localUri = await ensureImageCached(firstImageProduct.images[0], 'bulk_cover', onStatus);

      if (onStatus) onStatus('Abriendo sistema... 🚀');
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          '¡Catálogo Copiado!',
          'Texto de prendas copiado.\n\nComparte esta portada y pega el texto en el chat. (Para enviar todas las imágenes a la vez, usa "Catálogo PDF").',
          [{
            text: 'Continuar',
            onPress: async () => {
              if (onStatus) onStatus(null);
              await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
            }
          }]
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
