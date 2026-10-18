import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { OptimizedImage } from '../utils/imageOptimizer';

const WORKER_UPLOAD_URL = "https://inventario-r2-upload.kasakasports.workers.dev";

/**
 * Sube una imagen a Cloudflare R2 a través del Worker.
 * Usa FileSystem nativo en móviles y FormData estándar en Web.
 */
export async function uploadImageToR2(imageInfo: OptimizedImage): Promise<string> {
  const fileName = `product_${Date.now()}.webp`;

  if (Platform.OS === 'web') {
    // 🌐 Comportamiento en Navegador Web
    const formData = new FormData();
    if (imageInfo.blob) {
      formData.append("file", imageInfo.blob, fileName);
    }

    const response = await fetch(WORKER_UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error subiendo imagen (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.url;

  } else {
    // 📱 Comportamiento en Android / iOS usando motor nativo
    const response = await FileSystem.uploadAsync(WORKER_UPLOAD_URL, imageInfo.uri, {
      fieldName: 'file',
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      mimeType: 'image/webp'
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Error subiendo imagen (${response.status}): ${response.body}`);
    }

    const data = JSON.parse(response.body);
    return data.url;
  }
}

export async function deleteImageFromR2(imageUrl: string): Promise<void> {
  const response = await fetch(WORKER_UPLOAD_URL, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error eliminando imagen de R2: ${errorText}`);
  }
}
