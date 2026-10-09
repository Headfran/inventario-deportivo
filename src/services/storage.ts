const WORKER_UPLOAD_URL = "https://inventario-r2-upload.kasakasports.workers.dev";

/**
 * Sube una imagen (Blob o File) a Cloudflare R2 a través del Worker.
 * @param file Objeto File o Blob seleccionado desde el navegador o picker.
 * @returns Promesa con la URL pública de la imagen guardada.
 */
export async function uploadImageToR2(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, "product.avif");

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
