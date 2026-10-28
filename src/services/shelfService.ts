import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Shelf } from '../types/inventory';

const SHELVES_COLLECTION = 'shelves';

export const subscribeToShelves = (callback: (shelves: Shelf[]) => void) => {
  const q = query(collection(db, SHELVES_COLLECTION), orderBy('name', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const shelves: Shelf[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        description: data.description || '',
        rowsCount: Number(data.rowsCount) || 1,
        spacesPerRow: Number(data.spacesPerRow) || 3,
        unknownCells: Array.isArray(data.unknownCells) ? data.unknownCells : [],
      } as Shelf;
    });
    callback(shelves);
  });
};

export const createShelf = async (
  name: string,
  rowsCount = 1,
  spacesPerRow = 3,
  description?: string
): Promise<string> => {
  const docRef = await addDoc(collection(db, SHELVES_COLLECTION), {
    name: name.trim().toUpperCase(),
    rowsCount: Math.max(1, rowsCount),
    spacesPerRow: Math.max(1, spacesPerRow),
    description: description?.trim() || '',
    unknownCells: [],
  });
  return docRef.id;
};

/**
 * Actualiza los datos de un estante existente (nombre, filas, espacios, celdas desconocidas).
 */
export const updateShelf = async (
  shelfId: string,
  updatedData: Partial<Omit<Shelf, 'id'>>
): Promise<void> => {
  const shelfRef = doc(db, SHELVES_COLLECTION, shelfId);
  const payload: any = {};

  if (updatedData.name !== undefined) payload.name = updatedData.name.trim().toUpperCase();
  if (updatedData.rowsCount !== undefined) payload.rowsCount = Math.max(1, updatedData.rowsCount);
  if (updatedData.spacesPerRow !== undefined) payload.spacesPerRow = Math.max(1, updatedData.spacesPerRow);
  if (updatedData.description !== undefined) payload.description = updatedData.description.trim();
  if (updatedData.unknownCells !== undefined) {
    payload.unknownCells = Array.isArray(updatedData.unknownCells) ? updatedData.unknownCells : [];
  }

  await updateDoc(shelfRef, payload);
};

export const deleteShelf = async (shelfId: string): Promise<void> => {
  const shelfRef = doc(db, SHELVES_COLLECTION, shelfId);
  await deleteDoc(shelfRef);
};
