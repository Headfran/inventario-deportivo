const R2_PUBLIC_HOST = 'pub-693ae07616e4411bad90475e9ee4e365.r2.dev';
const R2_WORKER_HOST = 'inventario-r2-upload.kasakasports.workers.dev';

export const getCachedImageUrl = (url?: string): string | undefined => {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.host === R2_PUBLIC_HOST) {
      u.host = R2_WORKER_HOST;
      return u.toString();
    }
  } catch {
    // no es una URL válida, la devolvemos tal cual
  }
  return url;
};
