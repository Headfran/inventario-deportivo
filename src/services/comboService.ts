import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { Combo, AppliedCombo } from '../types/combo';
import { SaleItem } from '../types/sale';
import { Product } from '../types/inventory';

const COMBOS_COLLECTION = 'combos';

export const subscribeToCombos = (callback: (combos: Combo[]) => void) => {
  const q = query(collection(db, COMBOS_COLLECTION), orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const combos: Combo[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || '',
        price: Number(data.price) || 0,
        bolivarPrice: Number(data.bolivarPrice) || undefined,
        requirements: Array.isArray(data.requirements) ? data.requirements : [],
        isActive: data.isActive !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as Combo;
    });
    callback(combos);
  });
};

export const createCombo = async (combo: Omit<Combo, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, COMBOS_COLLECTION), {
    ...combo,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
};

export const updateCombo = async (comboId: string, updates: Partial<Combo>): Promise<void> => {
  await updateDoc(doc(db, COMBOS_COLLECTION, comboId), {
    ...updates,
    updatedAt: Date.now(),
  });
};

export const deleteCombo = async (comboId: string): Promise<void> => {
  await deleteDoc(doc(db, COMBOS_COLLECTION, comboId));
};

// ==========================================
// Lógica de elegibilidad reutilizable
// ==========================================
export interface ComboUnitResult {
  comboId: string;
  comboName: string;
  comboPrice: number;
  comboPriceBS: number;
  eligible: boolean;
  discount: number;
  itemKeys: Set<string>;
  normalPrice: number;
  takenQuantities: Record<string, number>;
}

export interface MultiComboResult {
  allEligible: boolean;
  eligibleCount: number;
  totalCount: number;
  totalDiscount: number;
  totalCombosUSD: number;
  totalCombosBSRef: number;
  consumedQuantities: Record<string, number>;
  appliedResults: ComboUnitResult[];
  itemComboMap: Record<string, string[]>;
}

export const checkMultiComboEligibility = (
  items: SaleItem[],
  products: Product[],
  combos: Combo[],
  appliedCombos: AppliedCombo[],
): MultiComboResult => {
  const empty: MultiComboResult = {
    allEligible: true,
    eligibleCount: 0,
    totalCount: 0,
    totalDiscount: 0,
    totalCombosUSD: 0,
    totalCombosBSRef: 0,
    consumedQuantities: {},
    appliedResults: [],
    itemComboMap: {},
  };
  if (!appliedCombos.length) return empty;

  const pool = items.map((item) => {
    const product = products.find((p) => (p.id || p.code) === item.productId);
    return {
      key: `${item.productId}_${item.color}_${item.size}`,
      category: product?.category || 'OTROS',
      remaining: item.quantity,
      initialQty: item.quantity,
      unitPrice: Number(product?.price) || item.unitPrice,
    };
  });

  const results: ComboUnitResult[] = [];

  for (const applied of appliedCombos) {
    const combo = combos.find((c) => c.id === applied.comboId);
    if (!combo) continue;
    const comboPriceBS =
      combo.bolivarPrice && combo.bolivarPrice > 0 ? combo.bolivarPrice : combo.price;

    for (let i = 0; i < applied.quantity; i++) {
      const poolCopy = pool.map((p) => ({ ...p }));
      const taken: Record<string, number> = {};
      let normalPrice = 0;
      let eligible = true;

      for (const req of combo.requirements) {
        let needed = req.quantity;
        for (const entry of poolCopy) {
          if (needed <= 0) break;
          if (entry.category !== req.category) continue;
          if (entry.remaining <= 0) continue;
          const take = Math.min(needed, entry.remaining);
          entry.remaining -= take;
          needed -= take;
          taken[entry.key] = (taken[entry.key] || 0) + take;
          normalPrice += take * entry.unitPrice;
        }
        if (needed > 0) { eligible = false; break; }
      }

      if (eligible) {
        for (const [key, qty] of Object.entries(taken)) {
          const entry = pool.find((p) => p.key === key);
          if (entry) entry.remaining -= qty;
        }
        results.push({
          comboId: combo.id!,
          comboName: combo.name,
          comboPrice: combo.price,
          comboPriceBS,
          eligible: true,
          discount: normalPrice - combo.price,
          itemKeys: new Set(Object.keys(taken)),
          normalPrice,
          takenQuantities: taken,
        });
      } else {
        results.push({
          comboId: combo.id!,
          comboName: combo.name,
          comboPrice: combo.price,
          comboPriceBS,
          eligible: false,
          discount: 0,
          itemKeys: new Set(),
          normalPrice: 0,
          takenQuantities: {},
        });
      }
    }
  }

  const consumedQuantities: Record<string, number> = {};
  pool.forEach((entry) => {
    const consumed = entry.initialQty - entry.remaining;
    if (consumed > 0) consumedQuantities[entry.key] = consumed;
  });

  const itemComboMap: Record<string, string[]> = {};
  results.filter((r) => r.eligible).forEach((r) => {
    r.itemKeys.forEach((key) => {
      if (!itemComboMap[key]) itemComboMap[key] = [];
      if (!itemComboMap[key].includes(r.comboName)) itemComboMap[key].push(r.comboName);
    });
  });

  const eligibleResults = results.filter((r) => r.eligible);
  const totalCombosUSD = eligibleResults.reduce((s, r) => s + r.comboPrice, 0);
  const totalCombosBSRef = eligibleResults.reduce((s, r) => s + r.comboPriceBS, 0);
  const totalDiscount = results.reduce((s, r) => s + r.discount, 0);

  return {
    allEligible: results.every((r) => r.eligible),
    eligibleCount: results.filter((r) => r.eligible).length,
    totalCount: results.length,
    totalDiscount,
    totalCombosUSD,
    totalCombosBSRef,
    consumedQuantities,
    appliedResults: results,
    itemComboMap,
  };
};
