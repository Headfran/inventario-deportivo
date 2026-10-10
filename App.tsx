import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   StyleSheet,
   TouchableOpacity,
   ActivityIndicator,
   SafeAreaView
} from 'react-native';
import { Package, MapPin, Lock, LogOut, ShoppingBag, BarChart3, Bell } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { PinScreen } from './src/screens/PinScreen';
import { PublicCatalogScreen } from './src/screens/PublicCatalogScreen';
import { InventoryListScreen } from './src/screens/InventoryListScreen';
import { ShelfMapScreen } from './src/screens/ShelfMapScreen';
import { SalesRegisterScreen } from './src/screens/SalesRegisterScreen';
import { AnalyticsDashboardScreen } from './src/screens/AnalyticsDashboardScreen';
import { requestNotificationPermission, listenForegroundMessages } from './src/services/notificationService';
import { showConfirm, showAlert } from './src/utils/alert';

type StaffTab = 'inventory' | 'shelves' | 'sales' | 'analytics';

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
   const [activeTab, setActiveTab] = useState<StaffTab>('inventory');
   const [notificationsEnabled, setNotificationsEnabled] = useState(false);

   // Solicitar permisos de notificación FCM al ingresar
   useEffect(() => {
      if (user && !isLocked) {
         requestNotificationPermission(user.uid).then((token) => {
            if (token) setNotificationsEnabled(true);
         });

         const unsubscribeFCM = listenForegroundMessages((payload) => {
            showAlert(
               payload.notification?.title || '⚠️ Alerta de Inventario',
               payload.notification?.body || 'Se ha recibido una actualización de stock.'
            );
         });

         return () => unsubscribeFCM();
      }
   }, [user, isLocked]);

   if (loading) {
      return (
         <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
         </View>
      );
   }

   // 1. Catálogo Público
   if (!showStaffPortal) {
      return (
         <PublicCatalogScreen
            onOpenStaffAccess={() => setShowStaffPortal(true)}
         />
      );
   }

   // 2. Login Firebase
   if (!user) {
      return <LoginScreen />;
   }

   // 3. Configuración PIN
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

   // 4. Desbloqueo PIN
   if (isLocked) {
      return (
         <PinScreen
            mode="UNLOCK"
            onSuccess={async (pin) => {
               if (pin) {
                  const valid = await unlockWithPin(pin);
                  if (!valid) {
                     showAlert('PIN Incorrecto', 'Verifica el código ingresado');
                  }
               }
            }}
            onCancelLogin={() => setShowStaffPortal(false)}
         />
      );
   }

   // 5. Panel Administrativo del Personal
   return (
      <SafeAreaView style={styles.container}>
         {/* Barra Superior del Panel */}
         <View style={styles.topBar}>
            <View style={styles.staffInfoGroup}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.staffTitle}>Panel del Personal</Text>
                  {notificationsEnabled && (
                     <View style={styles.bellBadge}>
                        <Bell size={12} color="#16a34a" />
                     </View>
                  )}
               </View>
               <Text style={styles.staffEmail}>{user.email}</Text>
            </View>

            <View style={styles.topActionsGroup}>
               <TouchableOpacity
                  style={styles.lockButton}
                  onPress={() => {
                     lockSession();
                     setShowStaffPortal(false);
                  }}
                  accessibilityLabel="Volver al catálogo"
               >
                  <Lock size={15} color="#cbd5e1" style={{ marginRight: 6 }} />
                  <Text style={styles.lockButtonText}>Ver Catálogo</Text>
               </TouchableOpacity>

               <TouchableOpacity
                  style={styles.logoutIconButton}
                  onPress={() => {
                     showConfirm(
                        'Cerrar Sesión',
                        '¿Deseas salir del sistema y eliminar el acceso rápido por PIN?',
                        async () => {
                           await logout();
                           setShowStaffPortal(false);
                        }
                     );
                  }}
                  accessibilityLabel="Cerrar Sesión"
               >
                  <LogOut size={16} color="#ef4444" />
               </TouchableOpacity>
            </View>
         </View>

         {/* Barra de Pestañas de Navegación */}
         <View style={styles.tabNavRow}>
            <TouchableOpacity
               style={[styles.tabButton, activeTab === 'inventory' && styles.tabButtonActive]}
               onPress={() => setActiveTab('inventory')}
            >
               <Package
                  size={18}
                  color={activeTab === 'inventory' ? '#2563eb' : '#64748b'}
                  style={{ marginRight: 8 }}
               />
               <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>
                  Inventario
               </Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={[styles.tabButton, activeTab === 'shelves' && styles.tabButtonActive]}
               onPress={() => setActiveTab('shelves')}
            >
               <MapPin
                  size={18}
                  color={activeTab === 'shelves' ? '#2563eb' : '#64748b'}
                  style={{ marginRight: 8 }}
               />
               <Text style={[styles.tabText, activeTab === 'shelves' && styles.tabTextActive]}>
                  Mapa Estantes
               </Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={[styles.tabButton, activeTab === 'sales' && styles.tabButtonActive]}
               onPress={() => setActiveTab('sales')}
            >
               <ShoppingBag
                  size={18}
                  color={activeTab === 'sales' ? '#2563eb' : '#64748b'}
                  style={{ marginRight: 8 }}
               />
               <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>
                  Punto de Venta
               </Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
               onPress={() => setActiveTab('analytics')}
            >
               <BarChart3
                  size={18}
                  color={activeTab === 'analytics' ? '#2563eb' : '#64748b'}
                  style={{ marginRight: 8 }}
               />
               <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
                  Analíticas
               </Text>
            </TouchableOpacity>
         </View>

         {/* Renderizado de la Pantalla Activa */}
         <View style={styles.tabContent}>
            {activeTab === 'inventory' && <InventoryListScreen />}
            {activeTab === 'shelves' && <ShelfMapScreen />}
            {activeTab === 'sales' && <SalesRegisterScreen />}
            {activeTab === 'analytics' && <AnalyticsDashboardScreen />}
         </View>
      </SafeAreaView>
   );
};

export default function App() {
   useEffect(() => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
         window.addEventListener('load', () => {
            navigator.serviceWorker
               .register('/firebase-messaging-sw.js')
               .then((reg) => console.log('Service Worker registrado correctamente:', reg.scope))
               .catch((err) => console.warn('Error al registrar Service Worker en inicio:', err));
         });
      }
   }, []);

   return (
      <GestureHandlerRootView style={{ flex: 1 }}>
         <AuthProvider>
            <MainApp />
         </AuthProvider>
      </GestureHandlerRootView>
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
      backgroundColor: '#f8fafc',
   },
   topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#0f172a',
   },
   staffInfoGroup: {
      flex: 1,
   },
   staffTitle: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: 'bold',
   },
   bellBadge: {
      backgroundColor: '#dcfce7',
      borderRadius: 10,
      padding: 3,
   },
   staffEmail: {
      color: '#94a3b8',
      fontSize: 11,
   },
   topActionsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
   },
   lockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1e293b',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
   },
   lockButtonText: {
      color: '#cbd5e1',
      fontSize: 12,
      fontWeight: '500',
   },
   logoutIconButton: {
      padding: 6,
      backgroundColor: '#1e293b',
      borderRadius: 6,
   },
   tabNavRow: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
   },
   tabButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
   },
   tabButtonActive: {
      borderBottomColor: '#2563eb',
      backgroundColor: '#f8fafc',
   },
   tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#64748b',
   },
   tabTextActive: {
      color: '#2563eb',
   },
   tabContent: {
      flex: 1,
   },
});
