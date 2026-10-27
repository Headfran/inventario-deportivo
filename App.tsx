import React, { useState, useEffect, useRef } from 'react';
import {

   View,
   Text,
   StyleSheet,
   Pressable,
   ActivityIndicator,
   SafeAreaView,
   Modal,
   Animated,
   useWindowDimensions,

} from 'react-native';
import { Package, MapPin, Lock, LogOut, ShoppingBag, BarChart3, Bell, Menu, X } from 'lucide-react-native';

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

import { MONO as T, display, ease, nd, reduced } from './src/design';



type StaffTab = 'inventory' | 'shelves' | 'sales' | 'analytics';



// Opciones del menú lateral

const NAV: { id: StaffTab; label: string; Icon: any }[] = [

   { id: 'inventory', label: 'Inventario', Icon: Package },

   { id: 'shelves', label: 'Mapa Estantes', Icon: MapPin },

   { id: 'sales', label: 'Punto de Venta', Icon: ShoppingBag },

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



   // ---- Solo diseño: menú lateral ----

   const { width } = useWindowDimensions();

   const narrow = width < 520;

   const drawerW = Math.min(310, Math.round(width * (narrow ? 0.84 : 0.34)));

   const [menuOpen, setMenuOpen] = useState(false);

   const menuAnim = useRef(new Animated.Value(0)).current;



   // Al abrir: el panel entra en 240ms con ease-out

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



   // Al cerrar: sale más rápido (160ms) y luego se oculta

   const closeMenu = () => {

      if (reduced()) {

         setMenuOpen(false);

         return;

      }

      Animated.timing(menuAnim, { toValue: 0, duration: 160, easing: ease, useNativeDriver: nd }).start(({ finished }) => {

         if (finished) setMenuOpen(false);

      });

   };



   // Acciones del banner (el mismo código de antes, usado también por el menú)

   const goCatalog = () => {

      lockSession();

      setShowStaffPortal(false);

   };



   const confirmLogout = () => {

      showConfirm(

         'Cerrar Sesión',

         '¿Deseas salir del sistema y eliminar el acceso rápido por PIN?',

         async () => {

            await logout();

            setShowStaffPortal(false);

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

            {activeTab === 'sales' && <SalesRegisterScreen />}

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

         <AuthProvider>

            <MainApp />

         </AuthProvider>

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



   // Menú lateral

   menuRoot: { flex: 1 },

   backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: T.overlay },

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
