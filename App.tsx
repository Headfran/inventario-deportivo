import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { Package, MapPin, Lock, LogOut, ShoppingBag, BarChart3, Bell, Receipt, Clock, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { PinScreen } from './src/screens/PinScreen';
import { PublicCatalogScreen } from './src/screens/PublicCatalogScreen';
import { InventoryListScreen } from './src/screens/InventoryListScreen';
import { ShelfMapScreen } from './src/screens/ShelfMapScreen';
import { SalesRegisterScreen } from './src/screens/SalesRegisterScreen';
import { AnalyticsDashboardScreen } from './src/screens/AnalyticsDashboardScreen';
import { SalesHistoryScreen } from './src/screens/SalesHistoryScreen';
import { LayawayScreen } from './src/screens/LayawayScreen';
import { SellerPerformanceScreen } from './src/screens/SellerPerformanceScreen';
import { requestNotificationPermission, listenForegroundMessages } from './src/services/notificationService';
import { getPendingSales, syncPendingSalesWithFirestore } from './src/services/offlineSyncService';
import { showConfirm, showAlert } from './src/utils/alert';

type StaffTab = 'inventory' | 'shelves' | 'sales' | 'layaways' | 'history' | 'sellers' | 'analytics';

const MainApp = () => {
   const { user, loading, isLocked, hasPin, unlockWithPin, setupPin, logout, lockSession } = useAuth();
   const [showStaffPortal, setShowStaffPortal] = useState(false);
   const [activeTab, setActiveTab] = useState<StaffTab>('inventory');
   const [notificationsEnabled, setNotificationsEnabled] = useState(false);

   const [isOnline, setIsOnline] = useState<boolean>(true);
   const [pendingCount, setPendingCount] = useState<number>(0);
   const [isSyncing, setIsSyncing] = useState<boolean>(false);

   const checkPendingSales = async () => {
      try { const pending = await getPendingSales(); setPendingCount(pending.length); }
      catch (e) { console.warn('Error al verificar cola offline:', e); }
   };

   const handleManualSync = async () => {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine) {
         showAlert('Sin Conexión', 'Asegúrate de tener acceso a internet antes de sincronizar.');
         return;
      }
      setIsSyncing(true);
      const result = await syncPendingSalesWithFirestore();
      setIsSyncing(false);
      await checkPendingSales();

      if (result.success > 0) showAlert('Sincronización Completada', `Se sincronizaron ${result.success} ventas con éxito.`);
      else if (result.failed > 0) showAlert('Sincronización Parcial', `${result.failed} ventas no pudieron enviarse.`);
      else showAlert('Todo al Día', 'No hay ventas pendientes por sincronizar.');
   };

   useEffect(() => {
      checkPendingSales();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
         setIsOnline(navigator.onLine);
         const handleOnline = async () => {
            setIsOnline(true);
            const result = await syncPendingSalesWithFirestore();
            if (result.success > 0) showAlert('🔄 Sincronización Automática', `Se han enviado ${result.success} ventas pendientes.`);
            checkPendingSales();
         };
         const handleOffline = () => setIsOnline(false);

         window.addEventListener('online', handleOnline);
         window.addEventListener('offline', handleOffline);
         return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
         };
      } else {
         // En nativo asumimos online por defecto para evitar bloqueos. 
         // Firebase intentará la conexión y si falla, usamos el try/catch de la pantalla.
         setIsOnline(true);
      }
   }, []);

   useEffect(() => {
      if (user && !isLocked) {
         requestNotificationPermission(user.uid).then((token) => { if (token) setNotificationsEnabled(true); });
         const unsubscribeFCM = listenForegroundMessages((payload) => {
            showAlert(payload.notification?.title || '⚠️ Alerta', payload.notification?.body || 'Actualización recibida.');
         });
         return () => unsubscribeFCM();
      }
   }, [user, isLocked]);

   if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
   if (!showStaffPortal) return <PublicCatalogScreen onOpenStaffAccess={() => setShowStaffPortal(true)} />;
   if (!user) return <LoginScreen />;
   if (!hasPin) return <PinScreen mode="SETUP" onSuccess={async (pin) => { if (pin) await setupPin(pin); }} />;
   if (isLocked) return <PinScreen mode="UNLOCK" onSuccess={async (pin) => { if (pin) { const valid = await unlockWithPin(pin); if (!valid) showAlert('PIN Incorrecto', 'Verifica el código ingresado'); } }} onCancelLogin={() => setShowStaffPortal(false)} />;

   return (
      <SafeAreaView style={styles.container}>
         <View style={styles.topBar}>
            <View style={styles.staffInfoGroup}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.staffTitle}>Panel del Personal</Text>
                  {notificationsEnabled && <View style={styles.bellBadge}><Bell size={12} color="#16a34a" /></View>}
               </View>
               <Text style={styles.staffEmail}>{user.email}</Text>
            </View>

            <View style={styles.topActionsGroup}>
               <View style={styles.connectionStatusGroup}>
                  {!isOnline ? (
                     <View style={styles.offlineBanner}><WifiOff size={13} color="#ef4444" /><Text style={styles.offlineBannerText}>Modo Offline</Text></View>
                  ) : (
                     <View style={styles.onlineBanner}><Wifi size={13} color="#16a34a" /><Text style={styles.onlineBannerText}>En Línea</Text></View>
                  )}
                  {pendingCount > 0 && (
                     <TouchableOpacity style={styles.syncPendingBtn} onPress={handleManualSync} disabled={isSyncing}>
                        <RefreshCw size={12} color="#ffffff" /><Text style={styles.syncPendingText}>{isSyncing ? 'Sincronizando...' : `${pendingCount} Pendientes`}</Text>
                     </TouchableOpacity>
                  )}
               </View>
               <TouchableOpacity style={styles.lockButton} onPress={() => { lockSession(); setShowStaffPortal(false); }}>
                  <Lock size={15} color="#cbd5e1" style={{ marginRight: 6 }} /><Text style={styles.lockButtonText}>Ver Catálogo</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.logoutIconButton} onPress={() => { showConfirm('Cerrar Sesión', '¿Deseas salir del sistema y eliminar el acceso rápido por PIN?', async () => { await logout(); setShowStaffPortal(false); }); }}>
                  <LogOut size={16} color="#ef4444" />
               </TouchableOpacity>
            </View>
         </View>

         <View style={styles.tabNavRow}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'inventory' && styles.tabButtonActive]} onPress={() => setActiveTab('inventory')}><Package size={18} color={activeTab === 'inventory' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>Inventario</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'shelves' && styles.tabButtonActive]} onPress={() => setActiveTab('shelves')}><MapPin size={18} color={activeTab === 'shelves' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'shelves' && styles.tabTextActive]}>Mapa Estantes</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'sales' && styles.tabButtonActive]} onPress={() => setActiveTab('sales')}><ShoppingBag size={18} color={activeTab === 'sales' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>Punto de Venta</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'layaways' && styles.tabButtonActive]} onPress={() => setActiveTab('layaways')}><Clock size={18} color={activeTab === 'layaways' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'layaways' && styles.tabTextActive]}>Apartados</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]} onPress={() => setActiveTab('history')}><Receipt size={18} color={activeTab === 'history' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Historial</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'sellers' && styles.tabButtonActive]} onPress={() => setActiveTab('sellers')}><Users size={18} color={activeTab === 'sellers' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'sellers' && styles.tabTextActive]}>Vendedores</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]} onPress={() => setActiveTab('analytics')}><BarChart3 size={18} color={activeTab === 'analytics' ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} /><Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>Analíticas</Text></TouchableOpacity>
         </View>

         <View style={styles.tabContent}>
            {activeTab === 'inventory' && <InventoryListScreen />}
            {activeTab === 'shelves' && <ShelfMapScreen />}
            {activeTab === 'sales' && <SalesRegisterScreen currentSellerName={user?.email || 'Vendedor'} currentSellerId={user?.uid} isOnline={isOnline} />}
            {activeTab === 'history' && <SalesHistoryScreen />}
            {activeTab === 'analytics' && <AnalyticsDashboardScreen />}
            {activeTab === 'layaways' && <LayawayScreen currentSellerName={user?.email || 'Vendedor'} currentSellerId={user?.uid} />}
            {activeTab === 'sellers' && <SellerPerformanceScreen />}
         </View>
      </SafeAreaView>
   );
};

export default function App() {
   useEffect(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
         window.addEventListener('load', () => {
            navigator.serviceWorker.register('/firebase-messaging-sw.js')
               .then((reg) => console.log('Service Worker registrado:', reg.scope))
               .catch((err) => console.warn('Error Service Worker:', err));
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
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
   container: { flex: 1, backgroundColor: '#f8fafc' },
   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0f172a' },
   staffInfoGroup: { flex: 1 },
   staffTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
   bellBadge: { backgroundColor: '#dcfce7', borderRadius: 10, padding: 3 },
   staffEmail: { color: '#94a3b8', fontSize: 11 },
   topActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
   connectionStatusGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 },
   offlineBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
   offlineBannerText: { fontSize: 11, color: '#ef4444', fontWeight: 'bold' },
   onlineBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
   onlineBannerText: { fontSize: 11, color: '#16a34a', fontWeight: 'bold' },
   syncPendingBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eab308', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
   syncPendingText: { fontSize: 11, color: '#ffffff', fontWeight: 'bold' },
   lockButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
   lockButtonText: { color: '#cbd5e1', fontSize: 12, fontWeight: '500' },
   logoutIconButton: { padding: 6, backgroundColor: '#1e293b', borderRadius: 6 },
   tabNavRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   tabButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
   tabButtonActive: { borderBottomColor: '#2563eb', backgroundColor: '#f8fafc' },
   tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
   tabTextActive: { color: '#2563eb' },
   tabContent: { flex: 1 },
});
