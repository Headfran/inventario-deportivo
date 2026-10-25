import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Seller } from '../types/sale';

export const createSeller = async (name: string): Promise<string> => {
  const newRef = doc(collection(db, 'sellers'));
  await setDoc(newRef, { name, createdAt: Timestamp.now() });
  return newRef.id;
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
