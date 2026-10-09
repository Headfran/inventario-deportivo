import React, { useState } from 'react';
import {
   View,
   Text,
   StyleSheet,
   TouchableOpacity,
   ActivityIndicator,
   Alert
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { PinScreen } from './src/screens/PinScreen';
import { PublicCatalogScreen } from './src/screens/PublicCatalogScreen';
import { InventoryListScreen } from './src/screens/InventoryListScreen';

const MainApp = () => {
   const {
      user,
      loading,
      isLocked,
      hasPin,
      unlockWithPin,
      setupPin,
      logout,
      lockSession
   } = useAuth();

   const [showStaffPortal, setShowStaffPortal] = useState(false);

   if (loading) {
      return (
         <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
         </View>
      );
   }

   // 1. Si no está activado el portal del personal, muestra SIEMPRE el Catálogo Público
   if (!showStaffPortal) {
      return (
         <PublicCatalogScreen
            onOpenStaffAccess={() => setShowStaffPortal(true)}
         />
      );
   }

   // 2. Si se presionó el botón de personal y no hay usuario autenticado en Firebase
   if (!user) {
      return <LoginScreen />;
   }

   // 3. Usuario autenticado pero sin PIN configurado
   if (!hasPin) {
      return (
         <PinScreen
            mode="SETUP"
            onSuccess={async (pin) => {
               if (pin) await setupPin(pin);
            }}
         />
      );
   }

   // 4. Usuario autenticado con PIN pero bloqueado
   if (isLocked) {
      return (
         <PinScreen
            mode="UNLOCK"
            onSuccess={async (pin) => {
               if (pin) {
                  const valid = await unlockWithPin(pin);
                  if (!valid) {
                     Alert.alert('PIN Incorrecto', 'Verifica el código ingresado');
                  }
               }
            }}
            onCancelLogin={() => {
               setShowStaffPortal(false);
            }}
         />
      );
   }

   // 5. Panel Administrativo del Personal (Autenticado y Desbloqueado)
   return (
      <View style={styles.container}>
         <View style={styles.topBar}>
            <Text style={styles.staffTitle}>Panel de Control - Inventario</Text>
            <TouchableOpacity
               style={styles.closePortalButton}
               onPress={() => {
                  lockSession();
                  setShowStaffPortal(false);
               }}
            >
               <Text style={styles.closePortalText}>Volver al Catálogo</Text>
            </TouchableOpacity>
         </View>

         <InventoryListScreen />
      </View>
   );
};

export default function App() {
   return (
      <AuthProvider>
         <MainApp />
      </AuthProvider>
   );
}

const styles = StyleSheet.create({
   centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f172a',
   },
   container: {
      flex: 1,
      backgroundColor: '#ffffff',
   },
   topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: '#0f172a',
   },
   staffTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
   },
   closePortalButton: {
      backgroundColor: '#334155',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
   },
   closePortalText: {
      color: '#cbd5e1',
      fontSize: 12,
      fontWeight: '500',
   },
   body: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
   },
   welcomeText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#0f172a',
   },
   infoText: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 8,
      marginBottom: 32,
      textAlign: 'center',
   },
   logoutButton: {
      backgroundColor: '#ef4444',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
   },
   logoutButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
   },
});
