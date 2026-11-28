import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppUser, UserRole } from '../types/user';

const USERS_COLLECTION = 'users';

const OWNER_EMAILS: string[] = [
  'vendedor@gmail.com',
];

const resolveRole = (email: string): UserRole => {
  return OWNER_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase())
    ? 'owner'
    : 'seller';
};

export const getOrCreateUser = async (uid: string, email: string): Promise<AppUser> => {
  const ref = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    return {
      uid,
      email: data.email || email,
      displayName: data.displayName,
      role: (data.role as UserRole) || resolveRole(email),
      isActive: data.isActive !== false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  const newUser: AppUser = {
    uid,
    email,
    role: resolveRole(email),
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(ref, newUser);
  return newUser;
};

export const subscribeToUser = (uid: string, callback: (u: AppUser | null) => void) => {
  return onSnapshot(
    doc(db, USERS_COLLECTION, uid),
    (snap) => {
      if (!snap.exists()) return callback(null);
      const data = snap.data();
      callback({
        uid,
        email: data.email || '',
        displayName: data.displayName,
        role: (data.role as UserRole) || 'seller',
        isActive: data.isActive !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    },
    (err) => {
      console.error('Error escuchando usuario:', err);
      callback(null);
    }
  );
};

/**
 * Validación defensiva de rol. No confía en el `isOwner` de la UI.
 * Lanza si el usuario autenticado no existe, está inactivo o no es dueño.
 */
export const assertOwner = async (): Promise<void> => {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No hay una sesión activa. Inicia sesión de nuevo.');
  }

  let snap;
  try {
    snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  } catch (error: any) {
    throw new Error(
      'No se pudo verificar tu rol. Revisa la conexión e inténtalo de nuevo.'
    );
  }

  if (!snap.exists()) {
    throw new Error('No se encontró tu perfil de usuario.');
  }

  const data = snap.data();
  if (data.isActive === false) {
    throw new Error('Tu usuario está desactivado.');
  }
  if (data.role !== 'owner') {
    throw new Error('Solo el dueño puede editar o anular ventas.');
  }
};

export const setUserRole = async (uid: string, role: UserRole): Promise<void> => {
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    role,
    updatedAt: Date.now(),
  });
};

export const setUserActive = async (uid: string, isActive: boolean): Promise<void> => {
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    isActive,
    updatedAt: Date.now(),
  });
};

export const subscribeToAllUsers = (callback: (users: AppUser[]) => void) => {
  const q = query(collection(db, USERS_COLLECTION), orderBy('email', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email || '',
        displayName: data.displayName,
        role: (data.role as UserRole) || 'seller',
        isActive: data.isActive !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as AppUser;
    });
    callback(users);
  });
};
