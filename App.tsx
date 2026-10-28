import React, { useState, useEffect, useRef } from 'react';
import {
   View,
   Text,
   StyleSheet,
   Pressable,
   ActivityIndicator,
   Modal,
   Animated,
   useWindowDimensions,
   Platform,
} from 'react-native';
import { Package, MapPin, Lock, LogOut, ShoppingBag, BarChart3, Bell, Menu, X, Receipt, Clock, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
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
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { MONO as T, display, ease, nd, reduced } from './src/design';

// Navegación persistente
const NAV_STORAGE_KEY = 'jdstore.activeTab.v1';

const getStoredTab = (): StaffTab | null => {
   if (typeof window === 'undefined' || !window.localStorage) return null;
   const saved = window.localStorage.getItem(NAV_STORAGE_KEY);
   // Validación: solo aceptamos tabs que existan en NAV
   const validTabs: StaffTab[] = ['inventory', 'shelves', 'sales', 'layaways', 'history', 'sellers', 'analytics'];
   return saved && validTabs.includes(saved as StaffTab) ? (saved as StaffTab) : null;
};

const storeTab = (tab: StaffTab) => {
   if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(NAV_STORAGE_KEY, tab);
   }
};

const PORTAL_STORAGE_KEY = 'jdstore.showStaffPortal.v1';

const getStoredPortal = (): boolean => {
   if (typeof window === 'undefined' || !window.localStorage) return false;
   return window.localStorage.getItem(PORTAL_STORAGE_KEY) === 'true';
};

const storePortal = (open: boolean) => {
   if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PORTAL_STORAGE_KEY, String(open));
   }
};

// Persistencia de Sesión
const UNLOCK_STORAGE_KEY = 'jdstore.unlockedAt.v1';
const UNLOCK_TTL_MS = 8 * 60 * 60 * 1000;

const getStoredSession = (): boolean => {
   if (typeof window === 'undefined' || !window.localStorage) return false;
   const raw = window.localStorage.getItem(UNLOCK_STORAGE_KEY);
   if (!raw) return false;
   const ts = Number(raw);
   return Number.isFinite(ts) && Date.now() - ts < UNLOCK_TTL_MS;
};

const markSessionUnlocked = () => {
   if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(UNLOCK_STORAGE_KEY, String(Date.now()));
   }
};

const clearSessionUnlocked = () => {
   if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(UNLOCK_STORAGE_KEY);
   }
};

type StaffTab = 'inventory' | 'shelves' | 'sales' | 'layaways' | 'history' | 'sellers' | 'analytics';

// ==========================================
// 7 opciones del menú lateral (de tu rama)
// ==========================================
const NAV: { id: StaffTab; label: string; Icon: any }[] = [
   { id: 'inventory', label: 'Inventario', Icon: Package },
   { id: 'shelves', label: 'Mapa Estantes', Icon: MapPin },
   { id: 'sales', label: 'Registro de Ventas', Icon: ShoppingBag },

   { id: 'history', label: 'Historial', Icon: Receipt },
   { id: 'sellers', label: 'Vendedores', Icon: Users },
   { id: 'analytics', label: 'Analíticas', Icon: BarChart3 },
];

// Botón con respuesta al presionar
const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

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

   const [showStaffPortal, setShowStaffPortal] = useState<boolean>(() => {
      return getStoredPortal();
   });
   const [activeTab, setActiveTab] = useState<StaffTab>(() => {
      return getStoredTab() ?? 'inventory';
   });
   const [notificationsEnabled, setNotificationsEnabled] = useState(false);

   // ---- Offline sync (backend de tu rama) ----
   const [isOnline, setIsOnline] = useState<boolean>(true);
   const [pendingCount, setPendingCount] = useState<number>(0);
   const [isSyncing, setIsSyncing] = useState<boolean>(false);
   const [sessionUnlocked, setSessionUnlocked] = useState<boolean>(() => getStoredSession());

   const checkPendingSales = async () => {
      try {
         const pending = await getPendingSales();
         setPendingCount(pending.length);
      } catch (e) {
         console.warn('Error al verificar cola offline:', e);
      }
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
            if (result.success > 0) {
               showAlert('🔄 Sincronización Automática', `Se han enviado ${result.success} ventas pendientes.`);
            }
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

   useEffect(() => {
      storePortal(showStaffPortal);
   }, [showStaffPortal]);

   useEffect(() => {
      if (user && hasPin && !isLocked) {
         storeTab(activeTab);
      }
   }, [activeTab, user, hasPin, isLocked]);

   useEffect(() => {
      const check = () => {
         if (sessionUnlocked && !getStoredSession()) {
            setSessionUnlocked(false);
         }
      };
      const id = setInterval(check, 60 * 1000);
      if (typeof document !== 'undefined') {
         document.addEventListener('visibilitychange', check);
      }
      return () => {
         clearInterval(id);
         if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', check);
         }
      };
   }, [sessionUnlocked]);

   // ---- Solo diseño: menú lateral ----
   const { width } = useWindowDimensions();
   const narrow = width < 520;
   const drawerW = Math.min(310, Math.round(width * (narrow ? 0.84 : 0.34)));
   const [menuOpen, setMenuOpen] = useState(false);
   const menuAnim = useRef(new Animated.Value(0)).current;

   useEffect(() => {
      if (!menuOpen) return;
      if (reduced()) {
         menuAnim.setValue(1);
         return;
      }
      Animated.timing(menuAnim, { toValue: 1, duration: 240, easing: ease, useNativeDriver: nd }).start();
   }, [menuOpen]);

   const openMenu = () => {
      menuAnim.setValue(0);
      setMenuOpen(true);
   };

   const closeMenu = () => {
      if (reduced()) {
         setMenuOpen(false);
         return;
      }
      Animated.timing(menuAnim, { toValue: 0, duration: 160, easing: ease, useNativeDriver: nd }).start(({ finished }) => {
         if (finished) setMenuOpen(false);
      });
   };

   const goCatalog = () => {
      lockSession();
      clearSessionUnlocked();
      setSessionUnlocked(false);
      setShowStaffPortal(false);
      storePortal(false);
   };

   const confirmLogout = () => {
      showConfirm(
         'Cerrar Sesión',
         '¿Deseas salir del sistema y eliminar el acceso rápido por PIN?',
         async () => {
            await logout();
            clearSessionUnlocked();
            setSessionUnlocked(false);
            setShowStaffPortal(false);
            storePortal(false);
         }
      );
   };

   if (loading) {
      return (
         <View style={styles.centered}>
            <ActivityIndicator size="large" color={T.onBar} />
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
         <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
            <PinScreen
               mode="SETUP"
               onSuccess={async (pin) => {
                  if (pin) await setupPin(pin);
               }}
               onCancelLogin={() => setShowStaffPortal(false)}
            />
         </View>
      );
   }

   // 4. Desbloqueo PIN
   if (isLocked && !sessionUnlocked) {
      return (
         <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
            <PinScreen
               mode="UNLOCK"
               onSuccess={async (pin) => {
                  if (pin) {
                     const valid = await unlockWithPin(pin);
                     if (valid) {
                        markSessionUnlocked();
                        setSessionUnlocked(true);
                     } else {
                        showAlert('PIN Incorrecto', 'Verifica el código ingresado');
                     }
                  }
               }}
               onCancelLogin={() => {
                  clearSessionUnlocked();
                  setSessionUnlocked(false);
                  setShowStaffPortal(false);
                  storePortal(false);
               }}
               onLogout={confirmLogout}
            />
         </View>
      );
   }

   const current = NAV.find((n) => n.id === activeTab);

   // 5. Panel Administrativo del Personal
   return (
      <SafeAreaView style={styles.container}>
         {/* Barra Superior del Panel (banner negro) */}
         <View style={styles.topBar}>
            <P style={styles.iconBtn} onPress={openMenu} accessibilityLabel="Abrir menú">
               <Menu size={22} color={T.onBar} />
            </P>

            <View style={styles.staffInfoGroup}>
               <View style={styles.titleRow}>
                  <Text style={styles.staffTitle}>Panel del Personal</Text>
                  {notificationsEnabled && (
                     <View style={styles.bellBadge}>
                        <Bell size={12} color={T.onBar} />
                     </View>
                  )}
                  {!narrow && current && (
                     <View style={styles.sectionPill}>
                        <Text style={styles.sectionPillText}>{current.label}</Text>
                     </View>
                  )}
               </View>
               <Text style={styles.staffEmail} numberOfLines={1}>{user.email}</Text>
            </View>

            <View style={styles.topActionsGroup}>
               {/* Indicador Online/Offline */}
               {!narrow && (
                  <View style={isOnline ? styles.onlineChip : styles.offlineChip}>
                     {isOnline ? <Wifi size={12} color={T.onBar} /> : <WifiOff size={12} color={T.onBar} />}
                     <Text style={styles.connectionText}>{isOnline ? 'En Línea' : 'Offline'}</Text>
                  </View>
               )}

               {/* Botón de Sincronización (solo si hay pendientes) */}
               {pendingCount > 0 && (
                  <P style={styles.syncBtn} onPress={handleManualSync} accessibilityLabel="Sincronizar ventas pendientes">
                     <RefreshCw size={13} color={T.onBar} />
                     {!narrow && (
                        <Text style={styles.syncBtnText}>
                           {isSyncing ? 'Sincronizando...' : `${pendingCount} Pend.`}
                        </Text>
                     )}
                  </P>
               )}

               <P style={styles.lockButton} onPress={goCatalog} accessibilityLabel="Volver al catálogo">
                  <Lock size={16} color={T.onBar} />
                  {!narrow && <Text style={styles.lockButtonText}>Ver Catálogo</Text>}
               </P>

               <P style={styles.iconBtn} onPress={confirmLogout} accessibilityLabel="Cerrar Sesión">
                  <LogOut size={17} color={T.onBar} />
               </P>
            </View>
         </View>

         {/* Renderizado de la Pantalla Activa */}
         <View style={styles.tabContent}>
            {activeTab === 'inventory' && <InventoryListScreen />}
            {activeTab === 'shelves' && <ShelfMapScreen />}
            {activeTab === 'sales' && <SalesRegisterScreen isOnline={isOnline} />}
            {activeTab === 'layaways' && (
               <LayawayScreen
                  currentSellerName={user?.email || 'Vendedor'}
                  currentSellerId={user?.uid}
               />
            )}
            {activeTab === 'history' && <SalesHistoryScreen />}
            {activeTab === 'sellers' && <SellerPerformanceScreen />}
            {activeTab === 'analytics' && <AnalyticsDashboardScreen />}
         </View>

         {/* Menú lateral desplegable */}
         <Modal visible={menuOpen} transparent animationType="none" onRequestClose={closeMenu}>
            <View style={styles.menuRoot}>
               <Animated.View style={[styles.backdrop, { opacity: menuAnim }]}>
                  <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityLabel="Cerrar menú" />
               </Animated.View>

               <Animated.View
                  style={[
                     styles.drawer,
                     { width: drawerW, transform: [{ translateX: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-drawerW, 0] }) }] },
                  ]}
               >
                  <View style={styles.drawerHead}>
                     <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.drawerTitle}>Panel del Personal</Text>
                        <Text style={styles.staffEmail} numberOfLines={1}>{user.email}</Text>
                     </View>
                     <P style={styles.iconBtn} onPress={closeMenu} accessibilityLabel="Cerrar menú">
                        <X size={20} color={T.onBar} />
                     </P>
                  </View>

                  <View style={styles.drawerItems}>
                     {NAV.map(({ id, label, Icon }) => {
                        const active = activeTab === id;
                        return (
                           <P
                              key={id}
                              style={[styles.navItem, active && styles.navItemActive]}
                              onPress={() => {
                                 setActiveTab(id);
                                 closeMenu();
                              }}
                           >
                              <Icon size={24} color={active ? T.ink : T.onBar} />
                              <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
                           </P>
                        );
                     })}
                  </View>

                  <View style={styles.drawerFooter}>
                     <P
                        style={styles.footerBtn}
                        onPress={() => {
                           closeMenu();
                           goCatalog();
                        }}
                     >
                        <Lock size={17} color={T.onBar} />
                        <Text style={styles.footerBtnText}>Ver Catálogo</Text>
                     </P>
                     <P
                        style={styles.footerBtn}
                        onPress={() => {
                           closeMenu();
                           confirmLogout();
                        }}
                     >
                        <LogOut size={17} color={T.onBar} />
                        <Text style={styles.footerBtnText}>Cerrar Sesión</Text>
                     </P>
                  </View>
               </Animated.View>
            </View>
         </Modal>
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
         <SafeAreaProvider>
            <AuthProvider>
               <MainApp />
            </AuthProvider>
         </SafeAreaProvider>
      </GestureHandlerRootView>
   );
}

const line = 'rgba(255,255,255,0.3)';

const styles = StyleSheet.create({
   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bar },
   container: { flex: 1, backgroundColor: T.bg },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   // Banner negro
   topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: T.bar },
   iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: line, borderRadius: 10 },
   staffInfoGroup: { flex: 1, minWidth: 0 },
   titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
   staffTitle: { ...display, color: T.onBar, fontSize: 24, lineHeight: 24, fontWeight: '800', textTransform: 'uppercase' },
   bellBadge: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: 4 },
   sectionPill: { borderWidth: 1, borderColor: line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
   sectionPillText: { color: T.onBar, fontSize: 12, fontWeight: '700' },
   staffEmail: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
   topActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   lockButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 14, borderWidth: 1, borderColor: line, borderRadius: 10 },
   lockButtonText: { color: T.onBar, fontSize: 13, fontWeight: '700' },
   tabContent: { flex: 1 },

   // Indicadores Online/Offline (integrados con la estética de main)
   onlineChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: line, borderRadius: 10 },
   offlineChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.55)', borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)' },
   connectionText: { color: T.onBar, fontSize: 12, fontWeight: '700' },
   syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(234,179,8,0.65)', borderRadius: 10, backgroundColor: 'rgba(234,179,8,0.18)' },
   syncBtnText: { color: T.onBar, fontSize: 12, fontWeight: '700' },

   // Menú lateral
   menuRoot: { flex: 1 },
   backdrop: { ...StyleSheet.absoluteFill, backgroundColor: T.overlay },
   drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      backgroundColor: '#34383D',
      paddingVertical: 16,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      overflow: 'hidden',
      borderRightWidth: 1,
      borderRightColor: '#4B5056',
   },

   drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)' },

   drawerTitle: { ...display, color: '#F5F6F7', fontSize: 18, lineHeight: 22, fontWeight: '800', textTransform: 'uppercase' },

   drawerItems: { flex: 1, paddingTop: 14, paddingHorizontal: 10, gap: 5 },

   navItem: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 48, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 10 },

   navItemActive: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#FFFFFF' },

   navText: { ...display, color: '#F1F3F5', fontSize: 16, lineHeight: 20, fontWeight: '700', textTransform: 'uppercase', flexShrink: 1 },

   navTextActive: { color: '#25292D' },

   drawerFooter: { paddingHorizontal: 10, gap: 7, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },

   footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 42, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },

   footerBtnText: { color: '#F1F3F5', fontSize: 12, fontWeight: '700' },
});
