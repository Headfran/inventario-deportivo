/**
 * Optimiza y comprime una imagen en el navegador mediante HTML Canvas.
 */
/**
 * Comprime y convierte una imagen al formato AVIF agresivo.
 */
export async function optimizeImage(file: File, maxWidth = 900, quality = 0.65): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se obtuvo el contexto Canvas 2D'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Intenta exportar a AVIF con fallback a WebP si el navegador antiguo no lo soporta
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              // Fallback a WebP si AVIF no es soportado por el motor del navegador
              canvas.toBlob(
                (fallbackBlob) => {
                  if (fallbackBlob) resolve(fallbackBlob);
                  else reject(new Error('Error al generar blob de la imagen'));
                },
                'image/webp',
                quality
              );
            }
          },
          'image/avif',
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}
