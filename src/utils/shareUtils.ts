import { Linking, Platform, Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Product } from '../types/inventory';

// ALGORITMO INTELIGENTE PARA ORDENAR TALLAS DE ROPA Y ZAPATOS
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

// MOTOR DE CACHÉ INTELIGENTE 
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

export const advancedNativeShare = async (product: Product, selectedColors: string[] = [], selectedImage?: string, onStatus?: (s: string | null) => void) => {
  const text = formatProductShareText(product, selectedColors);
  const targetImage = selectedImage || (product.images && product.images[0]);

  try {
    // ENTORNO PWA WEB (Chrome/Safari Móvil y Escritorio)
    if (Platform.OS === 'web') {
      if (navigator.share) {
        try {
          if (onStatus) onStatus('Preparando envío...');
          let shareData: ShareData = {
            title: product.code,
            text: text,
          };

          // MAGIA: Intentar compartir la foto en la Web PWA
          if (targetImage && navigator.canShare) {
            try {
              const response = await fetch(targetImage);
              const blob = await response.blob();
              const file = new File([blob], `${product.code}.jpg`, { type: 'image/jpeg' });

              if (navigator.canShare({ files: [file] })) {
                shareData.files = [file];
              }
            } catch (imgError) {
              console.log("La imagen no se pudo adjuntar en web, enviando solo texto.", imgError);
            }
          }

          await navigator.share(shareData);
          if (onStatus) onStatus(null);
          return;
        } catch (e: any) {
          if (onStatus) onStatus(null);
          // Si el usuario canceló el menú nativo, salimos sin hacer nada (No copiamos al portapapeles)
          if (e.name === 'AbortError') return;
        }
      }

      // FALLBACK: Computadoras o móviles sin HTTPS (Local)
      if (onStatus) onStatus('Generando enlace...');
      await Clipboard.setStringAsync(text);
      alert('Texto copiado al portapapeles. Pégalo en tu chat.');
      if (onStatus) onStatus(null);
      return;
    }

    // ENTORNO APP / EXPO GO (Móvil Nativo)
    if (targetImage) {
      if (onStatus) onStatus('Copiando detalles... 📋');
      await Clipboard.setStringAsync(text);

      const localUri = await ensureImageCached(targetImage, product.code || 'prenda', onStatus);

      if (onStatus) onStatus('Abriendo menú de compartir... 🚀');
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          '¡Texto Copiado!',
          'La información se copió al portapapeles.\n\nAl abrir WhatsApp o Instagram, presiona en el cuadro de texto y dale a "Pegar".',
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
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Catálogo', text: text });
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }

      await Clipboard.setStringAsync(text);
      alert('Catálogo copiado al portapapeles');
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
