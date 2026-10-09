import React, { createContext, useContext, useEffect, useState } from 'react';
import {
   onAuthStateChanged,
   signInWithEmailAndPassword,
   signOut,
   User
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { pinService } from '../services/pinService';

interface AuthContextType {
   user: User | null;
   loading: boolean;
   isLocked: boolean;
   hasPin: boolean;
   login: (email: string, pass: string) => Promise<void>;
   logout: () => Promise<void>;
   unlockWithPin: (pin: string) => Promise<boolean>;
   setupPin: (pin: string) => Promise<void>;
   lockSession: () => void; // <-- Nueva función
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);
   const [loading, setLoading] = useState(true);
   const [isLocked, setIsLocked] = useState(true);
   const [hasPin, setHasPin] = useState(false);

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
         }
         setLoading(false);
      });

      return () => unsubscribe();
   }, []);

   const login = async (email: string, pass: string) => {
      await signInWithEmailAndPassword(auth, email, pass);
   };

   const logout = async () => {
      await pinService.clearPin();
      await signOut(auth);
      setIsLocked(false);
      setHasPin(false);
   };

   const setupPin = async (pin: string) => {
      await pinService.savePin(pin);
      setHasPin(true);
      setIsLocked(false);
   };

   const unlockWithPin = async (pin: string): Promise<boolean> => {
      const isValid = await pinService.verifyPin(pin);
      if (isValid) {
         setIsLocked(false);
      }
      return isValid;
   };

   const lockSession = () => {
      if (hasPin) {
         setIsLocked(true);
      }
   };

   return (
      <AuthContext.Provider value={{
         user,
         loading,
         isLocked,
         hasPin,
         login,
         logout,
         unlockWithPin,
         setupPin,
         lockSession
      }}>
         {children}
      </AuthContext.Provider>
   );
};

export const useAuth = () => useContext(AuthContext);
