import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

export interface OptimizedImage {
  uri: string;
  blob?: Blob;
}

/**
 * Optimiza una imagen usando el motor nativo/web de Expo.
 * Redimensiona a 800px de ancho y convierte a WEBP.
 */
export async function optimizeImage(uri: string, maxWidth: number = 800, quality: number = 0.6): Promise<OptimizedImage> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }], // Mantiene el aspect ratio automáticamente
      { compress: quality, format: ImageManipulator.SaveFormat.WEBP }
    );

    // En Web, sí necesitamos convertirlo a Blob
    if (Platform.OS === 'web') {
      const response = await fetch(manipResult.uri);
      const blob = await response.blob();
      return { uri: manipResult.uri, blob };
    }

    // En Móvil (Android/iOS), devolvemos solo la URI. 
    // React Native manejará el archivo de forma nativa.
    return { uri: manipResult.uri };
  } catch (error) {
    console.error("Error optimizando imagen:", error);
    throw new Error("No se pudo comprimir la imagen.");
  }
}
