import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Seller } from '../types/sale';

const SELLERS_COLLECTION = 'sellers';

export const createSeller = async (name: string): Promise<string> => {
  const newRef = doc(collection(db, SELLERS_COLLECTION));
  await setDoc(newRef, { name, createdAt: Timestamp.now() });
  return newRef.id;
};

export const updateSeller = async (sellerId: string, newName: string): Promise<void> => {
  const ref = doc(db, SELLERS_COLLECTION, sellerId);
  await updateDoc(ref, { name: newName.trim() });
};

export const deleteSeller = async (sellerId: string): Promise<void> => {
  const ref = doc(db, SELLERS_COLLECTION, sellerId);
  await deleteDoc(ref);
};

export const subscribeToSellers = (callback: (sellers: Seller[]) => void) => {
  const q = query(collection(db, 'sellers'), orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const sellersList: Seller[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Seller[];
    callback(sellersList);
  });
};
