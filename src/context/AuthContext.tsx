import React, { createContext, useContext, useEffect, useState } from 'react';
import {
   onAuthStateChanged,
   signInWithEmailAndPassword,
   signOut,
   User,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { pinService } from '../services/pinService';
import { AppUser } from '../types/user';
import { getOrCreateUser, subscribeToUser } from '../services/userService';

interface AuthContextType {
   user: User | null;
   appUser: AppUser | null;
   loading: boolean;
   isLocked: boolean;
   hasPin: boolean;
   isOwner: boolean;
   login: (email: string, pass: string) => Promise<void>;
   logout: () => Promise<void>;
   unlockWithPin: (pin: string) => Promise<boolean>;
   setupPin: (pin: string) => Promise<void>;
   lockSession: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);
   const [appUser, setAppUser] = useState<AppUser | null>(null);
   const [loading, setLoading] = useState(true);
   const [isLocked, setIsLocked] = useState(true);
   const [hasPin, setHasPin] = useState(false);

   // 1. Auth listener
   useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
         setUser(currentUser);
         if (currentUser) {
            const savedPin = await pinService.getPin();
            setHasPin(!!savedPin);
            setIsLocked(!!savedPin);
         } else {
            setIsLocked(false);
            setHasPin(false);
            setAppUser(null);
         }
         setLoading(false);
      });

      return () => unsubscribe();
   }, []);

   // 2. Cargar appUser cuando cambia user.uid
   useEffect(() => {
      if (!user?.uid) {
         setAppUser(null);
         return;
      }

      let cancelled = false;
      let unsubscribe: (() => void) | undefined;

      (async () => {
         try {
            const au = await getOrCreateUser(user.uid, user.email || '');
            if (cancelled) return;
            setAppUser(au);
            // Suscripción en tiempo real para cambios de rol desde Firestore
            unsubscribe = subscribeToUser(user.uid, (updated) => {
               if (!cancelled) setAppUser(updated);
            });
         } catch (err) {
            console.warn('No se pudo cargar appUser:', err);
         }
      })();

      return () => {
         cancelled = true;
         if (unsubscribe) unsubscribe();
      };
   }, [user?.uid]);

   const login = async (email: string, pass: string) => {
      await signInWithEmailAndPassword(auth, email, pass);
   };

   const logout = async () => {
      await pinService.clearPin();
      await signOut(auth);
      setIsLocked(false);
      setHasPin(false);
      setAppUser(null);
   };

   const setupPin = async (pin: string) => {
      await pinService.savePin(pin);
      setHasPin(true);
      setIsLocked(false);
   };

   const unlockWithPin = async (pin: string): Promise<boolean> => {
      const isValid = await pinService.verifyPin(pin);
      if (isValid) setIsLocked(false);
      return isValid;
   };

   const lockSession = () => {
      if (hasPin) setIsLocked(true);
   };

   const isOwner = appUser?.role === 'owner';

   return (
      <AuthContext.Provider
         value={{
            user,
            appUser,
            loading,
            isLocked,
            hasPin,
            isOwner,
            login,
            logout,
            unlockWithPin,
            setupPin,
            lockSession,
         }}
      >
         {children}
      </AuthContext.Provider>
   );
};

export const useAuth = () => useContext(AuthContext);
