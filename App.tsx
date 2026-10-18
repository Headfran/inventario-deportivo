import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform, Modal, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { Package, MapPin, Lock, LogOut, ShoppingBag, BarChart3, Bell, Receipt, Clock, Users, Wifi, WifiOff, RefreshCw, Menu, X, ChevronRight } from 'lucide-react-native';
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

// ==========================================
// DEFINICIÓN DE LAS TABS (una sola fuente de verdad)
// ==========================================
interface MenuItem { id: StaffTab; label: string; icon: any; }

const MENU_ITEMS: MenuItem[] = [
   { id: 'inventory', label: 'Inventario', icon: Package },
   { id: 'shelves', label: 'Mapa Estantes', icon: MapPin },
   { id: 'sales', label: 'Punto de Venta', icon: ShoppingBag },
   { id: 'layaways', label: 'Apartados', icon: Clock },
   { id: 'history', label: 'Historial', icon: Receipt },
   { id: 'sellers', label: 'Vendedores', icon: Users },
   { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
];

// ==========================================
// PWA: TIPOS Y HOOK DE INSTALACIÓN
// ==========================================
interface BeforeInstallPromptEvent extends Event {
   readonly platforms: string[];
   readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
   prompt(): Promise<void>;
}

const usePWAInstall = () => {
   const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
   const [isInstallable, setIsInstallable] = useState(false);
   const [isInstalled, setIsInstalled] = useState(false);
   const [isIOS, setIsIOS] = useState(false);

   useEffect(() => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return;

      const standalone =
         window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
      setIsInstalled(standalone);

      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(ios);

      const onBeforeInstall = (e: Event) => {
         e.preventDefault();
         setDeferredPrompt(e as BeforeInstallPromptEvent);
         setIsInstallable(true);
      };
      const onInstalled = () => {
         setIsInstalled(true);
         setIsInstallable(false);
         setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', onBeforeInstall);
      window.addEventListener('appinstalled', onInstalled);
      return () => {
         window.removeEventListener('beforeinstallprompt', onBeforeInstall);
         window.removeEventListener('appinstalled', onInstalled);
      };
   }, []);

   const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
      if (!deferredPrompt) return 'unavailable';
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
         setIsInstalled(true);
         setIsInstallable(false);
      }
      setDeferredPrompt(null);
      return outcome;
   }, [deferredPrompt]);

   return { isInstallable, isInstalled, isIOS, promptInstall };
};

// ==========================================
// PWA: BOTÓN FLOTANTE DE INSTALACIÓN
// ==========================================
const InstallPWAButton: React.FC<{ install: ReturnType<typeof usePWAInstall> }> = ({ install }) => {
   const [showIOSHint, setShowIOSHint] = useState(false);

   if (install.isInstalled) return null;
   if (!install.isInstallable && !install.isIOS) return null;

   const onPress = async () => {
      if (install.isIOS) {
         setShowIOSHint(true);
         return;
      }
      await install.promptInstall();
   };

   return (
      <>
         <TouchableOpacity style={styles.installBtn} onPress={onPress}>
            <Text style={styles.installBtnText}>📲 Instalar App</Text>
         </TouchableOpacity>

         {showIOSHint && (
            <View style={styles.iosHintOverlay}>
               <View style={styles.iosHintCard}>
                  <Text style={styles.iosHintTitle}>Instalar en iOS</Text>
                  <Text style={styles.iosHintText}>
                     1. Toca el botón <Text style={{ fontWeight: 'bold' }}>Compartir</Text> (⬆️) de Safari.{'\n\n'}
                     2. Selecciona <Text style={{ fontWeight: 'bold' }}>Añadir a pantalla de inicio</Text>.{'\n\n'}
                     3. Confirma con <Text style={{ fontWeight: 'bold' }}>Añadir</Text>.
                  </Text>
                  <TouchableOpacity style={styles.iosHintClose} onPress={() => setShowIOSHint(false)}>
                     <Text style={styles.iosHintCloseText}>Entendido</Text>
                  </TouchableOpacity>
               </View>
            </View>
         )}
      </>
   );
};

// ==========================================
// APLICACIÓN PRINCIPAL
// ==========================================
const MainApp = () => {
   const { user, loading, isLocked, hasPin, unlockWithPin, setupPin, logout, lockSession } = useAuth();
   const [showStaffPortal, setShowStaffPortal] = useState(false);
   const [activeTab, setActiveTab] = useState<StaffTab>('inventory');
   const [notificationsEnabled, setNotificationsEnabled] = useState(false);
   const [menuOpen, setMenuOpen] = useState(false);

   const { width } = useWindowDimensions();
   const isMobile = width < 900;

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

   const currentTabLabel = MENU_ITEMS.find(m => m.id === activeTab)?.label || 'Panel';

   return (
      <SafeAreaView style={styles.container}>
         <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
            <View style={styles.staffInfoGroup}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.staffTitle} numberOfLines={1}>Panel del Personal</Text>
                  {notificationsEnabled && <View style={styles.bellBadge}><Bell size={12} color="#16a34a" /></View>}
               </View>
               <Text style={styles.staffEmail} numberOfLines={1}>{user.email}</Text>
            </View>

            <View style={styles.topActionsGroup}>
               <View style={styles.connectionStatusGroup}>
                  {!isOnline ? (
                     <View style={styles.offlineBanner}>
                        <WifiOff size={13} color="#ef4444" />
                        {!isMobile && <Text style={styles.offlineBannerText}>Modo Offline</Text>}
                     </View>
                  ) : (
                     <View style={styles.onlineBanner}>
                        <Wifi size={13} color="#16a34a" />
                        {!isMobile && <Text style={styles.onlineBannerText}>En Línea</Text>}
                     </View>
                  )}
                  {pendingCount > 0 && (
                     <TouchableOpacity style={styles.syncPendingBtn} onPress={handleManualSync} disabled={isSyncing}>
                        <RefreshCw size={12} color="#ffffff" />
                        {!isMobile && <Text style={styles.syncPendingText}>{isSyncing ? 'Sincronizando...' : `${pendingCount} Pendientes`}</Text>}
                     </TouchableOpacity>
                  )}
               </View>
               <TouchableOpacity style={styles.lockButton} onPress={() => { lockSession(); setShowStaffPortal(false); }}>
                  <Lock size={15} color="#cbd5e1" style={!isMobile ? { marginRight: 6 } : undefined} />
                  {!isMobile && <Text style={styles.lockButtonText}>Ver Catálogo</Text>}
               </TouchableOpacity>
               <TouchableOpacity style={styles.logoutIconButton} onPress={() => { showConfirm('Cerrar Sesión', '¿Deseas salir del sistema y eliminar el acceso rápido por PIN?', async () => { await logout(); setShowStaffPortal(false); }); }}>
                  <LogOut size={16} color="#ef4444" />
               </TouchableOpacity>
            </View>
         </View>

         {/* ==========================================
             NAV RESPONSIVE: DRAWER EN MÓVIL / TABS EN DESKTOP
             ========================================== */}
         {isMobile ? (
            <View style={styles.mobileNavBar}>
               <TouchableOpacity
                  onPress={() => setMenuOpen(true)}
                  style={styles.hamburgerBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
               >
                  <Menu size={22} color="#ffffff" />
               </TouchableOpacity>
               <Text style={styles.mobileNavTitle} numberOfLines={1}>{currentTabLabel}</Text>
               <View style={{ width: 42 }} />
            </View>
         ) : (
            <View style={styles.tabNavRow}>
               {MENU_ITEMS.map(item => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                     <TouchableOpacity
                        key={item.id}
                        style={[styles.tabButton, active && styles.tabButtonActive]}
                        onPress={() => setActiveTab(item.id)}
                     >
                        <Icon size={18} color={active ? '#2563eb' : '#64748b'} style={{ marginRight: 8 }} />
                        <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
                     </TouchableOpacity>
                  );
               })}
            </View>
         )}

         <View style={styles.tabContent}>
            {activeTab === 'inventory' && <InventoryListScreen />}
            {activeTab === 'shelves' && <ShelfMapScreen />}
            {activeTab === 'sales' && <SalesRegisterScreen currentSellerName={user?.email || 'Vendedor'} currentSellerId={user?.uid} isOnline={isOnline} />}
            {activeTab === 'history' && <SalesHistoryScreen />}
            {activeTab === 'analytics' && <AnalyticsDashboardScreen />}
            {activeTab === 'layaways' && <LayawayScreen currentSellerName={user?.email || 'Vendedor'} currentSellerId={user?.uid} />}
            {activeTab === 'sellers' && <SellerPerformanceScreen />}
         </View>

         {/* ==========================================
             DRAWER LATERAL (solo en móvil)
             ========================================== */}
         <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
            <Pressable style={styles.drawerBackdrop} onPress={() => setMenuOpen(false)}>
               <Pressable style={styles.drawer} onPress={e => e.stopPropagation()}>
                  <SafeAreaView style={{ flex: 1 }}>
                     <View style={styles.drawerHeader}>
                        <Text style={styles.drawerTitle}>Menú</Text>
                        <TouchableOpacity
                           onPress={() => setMenuOpen(false)}
                           style={styles.drawerCloseBtn}
                           hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                           <X size={22} color="#0f172a" />
                        </TouchableOpacity>
                     </View>
                     <ScrollView>
                        {MENU_ITEMS.map(item => {
                           const Icon = item.icon;
                           const active = activeTab === item.id;
                           return (
                              <TouchableOpacity
                                 key={item.id}
                                 style={[styles.drawerItem, active && styles.drawerItemActive]}
                                 onPress={() => { setActiveTab(item.id); setMenuOpen(false); }}
                              >
                                 <Icon size={20} color={active ? '#2563eb' : '#64748b'} />
                                 <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{item.label}</Text>
                                 {active && <ChevronRight size={18} color="#2563eb" />}
                              </TouchableOpacity>
                           );
                        })}
                     </ScrollView>
                  </SafeAreaView>
               </Pressable>
            </Pressable>
         </Modal>
      </SafeAreaView>
   );
};

// ==========================================
// APP RAÍZ
// ==========================================
export default function App() {
   const pwa = usePWAInstall();

   useEffect(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
         // Registrar SIN esperar 'load' → Chrome lo prefiere para instalabilidad
         navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then((reg) => console.log('Service Worker registrado:', reg.scope))
            .catch((err) => console.warn('Error Service Worker:', err));
      }
   }, []);

   return (
      <GestureHandlerRootView style={{ flex: 1 }}>
         <AuthProvider>
            <MainApp />
            <InstallPWAButton install={pwa} />
         </AuthProvider>
      </GestureHandlerRootView>
   );
}

const styles = StyleSheet.create({
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
   container: { flex: 1, backgroundColor: '#f8fafc' },

   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0f172a' },
   topBarMobile: { paddingHorizontal: 10, paddingVertical: 10 },
   staffInfoGroup: { flex: 1, marginRight: 8 },
   staffTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
   bellBadge: { backgroundColor: '#dcfce7', borderRadius: 10, padding: 3 },
   staffEmail: { color: '#94a3b8', fontSize: 11 },
   topActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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

   // Tabs desktop
   tabNavRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   tabButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
   tabButtonActive: { borderBottomColor: '#2563eb', backgroundColor: '#f8fafc' },
   tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
   tabTextActive: { color: '#2563eb' },

   // Barra de navegación móvil (con hamburguesa)
   mobileNavBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
   hamburgerBtn: { padding: 6 },
   mobileNavTitle: { flex: 1, textAlign: 'center', color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

   // Drawer
   drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
   drawer: { width: '80%', maxWidth: 340, height: '100%', backgroundColor: '#ffffff' },
   drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   drawerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
   drawerCloseBtn: { padding: 4 },
   drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
   drawerItemActive: { backgroundColor: '#eff6ff', borderLeftWidth: 3, borderLeftColor: '#2563eb' },
   drawerItemText: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '500' },
   drawerItemTextActive: { color: '#2563eb', fontWeight: 'bold' },

   tabContent: { flex: 1 },

   // PWA: botón flotante
   installBtn: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      backgroundColor: '#2563eb',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      zIndex: 9999,
   },
   installBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
   iosHintOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: 20,
   },
   iosHintCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, maxWidth: 340 },
   iosHintTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#0f172a' },
   iosHintText: { fontSize: 14, color: '#334155', lineHeight: 22 },
   iosHintClose: { marginTop: 16, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#2563eb', borderRadius: 8 },
   iosHintCloseText: { color: '#ffffff', fontWeight: 'bold' },
});
