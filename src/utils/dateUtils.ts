/**
 * Normaliza fechas de Firestore (Timestamp), Date, segundos o strings.
 * Devuelve null si el valor no representa una fecha válida.
 */
export const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  if (typeof value?.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

/** Formatea una fecha histórica de forma estable (no usa "ahora" como fallback). */
export const formatDateTime = (
  value: any,
  style: 'short' | 'long' = 'short'
): string => {
  const date = toDate(value);
  if (!date) return 'Fecha no disponible';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return style === 'long'
    ? `${day}/${month}/${year} a las ${hour12}:${minutes} ${ampm}`
    : `${day}/${month}/${year} ${hour12}:${minutes} ${ampm}`;
};

export const formatDate = (value: any): string => {
  const date = toDate(value);
  if (!date) return 'Fecha no disponible';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};
