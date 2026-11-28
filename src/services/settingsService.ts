import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { roundMoney } from '../utils/pricingUtils';

export interface RatesConfig {
  eurToBsRate: number;
  usdToBsRate: number;
  /** Epoch ms del último guardado. */
  updatedAt: number;
  updatedBy: string;
}

export const DEFAULT_RATES: RatesConfig = {
  eurToBsRate: 50,
  usdToBsRate: 50,
  updatedAt: 0,
  updatedBy: '',
};

const SETTINGS_COLLECTION = 'settings';
const RATES_DOC_ID = 'rates';

const ratesDocRef = () => doc(db, SETTINGS_COLLECTION, RATES_DOC_ID);

const toPositiveRate = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return roundMoney(parsed);
};

const parseRates = (data: any): RatesConfig | null => {
  if (!data) return null;
  const eur = toPositiveRate(data.eurToBsRate);
  const usd = toPositiveRate(data.usdToBsRate);
  if (eur === null || usd === null) return null;

  const rawUpdatedAt = data.updatedAt;
  const updatedAtMs =
    typeof rawUpdatedAt?.toMillis === 'function'
      ? rawUpdatedAt.toMillis()
      : typeof rawUpdatedAt?.toDate === 'function'
        ? rawUpdatedAt.toDate().getTime()
        : Number(rawUpdatedAt) || 0;

  return {
    eurToBsRate: eur,
    usdToBsRate: usd,
    updatedAt: updatedAtMs,
    updatedBy: String(data.updatedBy || ''),
  };
};

/** Suscripción en tiempo real a `settings/rates`. */
export const subscribeToRates = (callback: (rates: RatesConfig | null) => void) => {
  if (!db) return () => { };

  return onSnapshot(
    ratesDocRef(),
    (snap) => {
      callback(snap.exists() ? parseRates(snap.data()) : null);
    },
    (error) => {
      console.error('Error escuchando settings/rates:', error);
    }
  );
};

export const getRates = async (): Promise<RatesConfig | null> => {
  if (!db) return null;
  try {
    const snap = await getDoc(ratesDocRef());
    return snap.exists() ? parseRates(snap.data()) : null;
  } catch (error) {
    console.error('Error leyendo settings/rates:', error);
    return null;
  }
};

/** Guarda la tasa central. Todos los POS suscritos la reciben al instante. */
export const saveRates = async (
  input: { eurToBsRate: number; usdToBsRate: number },
  updatedBy: string
): Promise<RatesConfig> => {
  const eur = toPositiveRate(input.eurToBsRate);
  const usd = toPositiveRate(input.usdToBsRate);

  if (eur === null || usd === null) {
    throw new Error('Las tasas deben ser números mayores a 0.');
  }

  const config: RatesConfig = {
    eurToBsRate: eur,
    usdToBsRate: usd,
    updatedAt: Date.now(),
    updatedBy: updatedBy || 'Personal',
  };

  await setDoc(ratesDocRef(), config, { merge: true });
  return config;
};

export interface RemoteRatesResult {
  eurToBsRate?: number;
  usdToBsRate?: number;
  eurUpdatedAt?: string;
  usdUpdatedAt?: string;
  errors: string[];
}

const API_USD = 'https://ve.dolarapi.com/v1/dolares';
const API_EUR = 'https://ve.dolarapi.com/v1/euros';
const FETCH_TIMEOUT_MS = 10_000;

const fetchJson = async (url: string): Promise<any> => {
  if (typeof fetch !== 'function') {
    throw new Error('Este entorno no permite consultar la API de tasas.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`La API respondió con estado ${response.status}.`);
    }
    return await response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('La consulta de tasas tardó demasiado (timeout).');
    }
    throw new Error(
      'No se pudo contactar la API de tasas. Puede ser un problema de red, ' +
      'de CORS o que el servicio no esté disponible.'
    );
  } finally {
    clearTimeout(timer);
  }
};

const pickOfficialRate = (
  payload: any,
  currency: 'USD' | 'EUR'
): { rate: number; updatedAt?: string } | null => {
  const list = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const currencyItems = list.filter(
    (item: any) => String(item?.moneda || '').toUpperCase() === currency
  );
  const official =
    currencyItems.find(
      (item: any) => String(item?.fuente || '').toLowerCase() === 'oficial'
    ) || currencyItems[0];

  if (!official) return null;

  const rawRate = Number(official.promedio ?? official.venta ?? official.compra);
  if (!Number.isFinite(rawRate) || rawRate <= 0) return null;

  return {
    rate: roundMoney(rawRate),
    updatedAt: official.fechaActualizacion
      ? String(official.fechaActualizacion)
      : undefined,
  };
};

/**
 * Consulta las tasas oficiales de Venezuela (dolarapi.com).
 * Si un endpoint falla, devuelve la otra tasa disponible y reporta el error.
 */
export const fetchVenezuelaRates = async (): Promise<RemoteRatesResult> => {
  const [usdResult, eurResult] = await Promise.allSettled([
    fetchJson(API_USD),
    fetchJson(API_EUR),
  ]);

  const result: RemoteRatesResult = { errors: [] };

  if (usdResult.status === 'fulfilled') {
    const usd = pickOfficialRate(usdResult.value, 'USD');
    if (usd) {
      result.usdToBsRate = usd.rate;
      result.usdUpdatedAt = usd.updatedAt;
    } else {
      result.errors.push('La API no devolvió una tasa USD válida.');
    }
  } else {
    result.errors.push(usdResult.reason?.message || 'No se pudo obtener la tasa USD.');
  }

  if (eurResult.status === 'fulfilled') {
    const eur = pickOfficialRate(eurResult.value, 'EUR');
    if (eur) {
      result.eurToBsRate = eur.rate;
      result.eurUpdatedAt = eur.updatedAt;
    } else {
      result.errors.push('La API no devolvió una tasa EUR válida.');
    }
  } else {
    result.errors.push(eurResult.reason?.message || 'No se pudo obtener la tasa EUR.');
  }

  if (result.eurToBsRate === undefined && result.usdToBsRate === undefined) {
    throw new Error(
      result.errors[0] ||
      'No se pudieron consultar las tasas. Revisa tu conexión o inténtalo más tarde.'
    );
  }

  return result;
};
