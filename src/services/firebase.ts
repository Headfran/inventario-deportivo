import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCX2mzrwuNpVCJFMD-OPaK9HrboLeWYuRw",
  authDomain: "inventario-deportivo-app.firebaseapp.com",
  projectId: "inventario-deportivo-app",
  storageBucket: "inventario-deportivo-app.firebasestorage.app",
  messagingSenderId: "628045340382",
  appId: "1:628045340382:web:55abbc9a8df7818ba12c4f"
};

// Inicializar Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Exportar instancias de servicios
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
