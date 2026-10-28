import React, { useState, useRef, useEffect } from 'react';
import {
   View,
   Text,
   TouchableOpacity,
   StyleSheet,
   Animated,
   StatusBar,
   SafeAreaView,
   Platform,
   useWindowDimensions,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

interface PinScreenProps {
   mode: 'SETUP' | 'UNLOCK';
   onSuccess: (pin?: string) => void;
   onCancelLogin?: () => void;
   onLogout?: () => void;
}

export const PinScreen: React.FC<PinScreenProps> = ({ mode, onSuccess, onCancelLogin, onLogout }) => {
   // ---- LÓGICA ORIGINAL (sin cambios) ----
   const [pin, setPin] = useState('');

   const handleKeyPress = (num: string) => {
      if (pin.length < 4) {
         const newPin = pin + num;
         setPin(newPin);

         if (newPin.length === 4) {
            setTimeout(() => {
               onSuccess(newPin);
               setPin('');
            }, 150);
         }
      }
   };

   const handleDelete = () => {
      setPin(prev => prev.slice(0, -1));
   };

   // ---- SOLO DISEÑO ----
   const fade = useRef(new Animated.Value(0)).current;
   const slide = useRef(new Animated.Value(30)).current;

   useEffect(() => {
      Animated.parallel([
         Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
         Animated.timing(slide, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
   }, []);

   const Container = Platform.OS === 'web' ? View : SafeAreaView;
   const { height: viewportHeight } = useWindowDimensions();
   const webSafeStyle = Platform.OS === 'web'
      ? { minHeight: viewportHeight, width: '100%' }
      : undefined;

   const showForgotPin = mode === 'UNLOCK' && !!onLogout;

   return (
      <Container style={[styles.container]}>
         <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

         {onCancelLogin && (
            <TouchableOpacity
               style={styles.backBtn}
               onPress={onCancelLogin}
               activeOpacity={0.7}
               accessibilityLabel="Regresar"
            >
               <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
         )}

         <View style={styles.shapeBig} />
         <View style={styles.shapeSmall} />

         <Animated.View
            style={[styles.content, { opacity: fade, transform: [{ translateY: slide }] }]}
         >
            <View style={styles.accentLine} />
            <Text style={styles.title}>
               {mode === 'SETUP' ? 'CREA UN PIN DE ACCESO RÁPIDO' : 'INGRESA TU PIN DE ACCESO'}
            </Text>
            <Text style={styles.subtitle}>
               {mode === 'SETUP'
                  ? 'Este PIN de 4 dígitos te permitirá desbloquear la app rápidamente'
                  : 'Ingresa los 4 dígitos para continuar'}
            </Text>

            <View style={styles.dotsContainer}>
               {[0, 1, 2, 3].map((index) => (
                  <View key={index} style={[styles.dot, pin.length > index && styles.dotFilled]} />
               ))}
            </View>

            <View style={styles.keypad}>
               {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
                  <View key={rIdx} style={styles.row}>
                     {row.map((num) => (
                        <TouchableOpacity
                           key={num}
                           style={styles.key}
                           activeOpacity={0.6}
                           onPress={() => handleKeyPress(num)}
                        >
                           <Text style={styles.keyText}>{num}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>
               ))}
               <View style={styles.row}>
                  {onCancelLogin ? (
                     <TouchableOpacity style={styles.keyAction} onPress={onCancelLogin}>
                        <Text style={styles.actionText}>SALIR</Text>
                     </TouchableOpacity>
                  ) : (
                     <View style={styles.keyEmpty} />
                  )}

                  <TouchableOpacity
                     style={styles.key}
                     activeOpacity={0.6}
                     onPress={() => handleKeyPress('0')}
                  >
                     <Text style={styles.keyText}>0</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.keyAction} onPress={handleDelete}>
                     <Text style={styles.actionText}>BORRAR</Text>
                  </TouchableOpacity>
               </View>
            </View>

            {showForgotPin && (
               <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={onLogout}
                  activeOpacity={0.7}
                  accessibilityLabel="Olvidé mi PIN, cerrar sesión"
               >
                  <Text style={styles.forgotText}>¿OLVIDASTE TU PIN? CERRAR SESIÓN</Text>
               </TouchableOpacity>
            )}
         </Animated.View>
      </Container>
   );
};

const styles = StyleSheet.create({
   container: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0A0A0A',
      padding: 20,
   },

   backBtn: {
      position: 'absolute',
      top: 20,
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
   },

   shapeBig: {
      position: 'absolute',
      top: -120,
      right: -140,
      width: 340,
      height: 340,
      backgroundColor: '#161616',
      transform: [{ rotate: '35deg' }],
      borderRadius: 40,
   },
   shapeSmall: {
      position: 'absolute',
      bottom: -90,
      left: -100,
      width: 240,
      height: 240,
      backgroundColor: '#1C1C1C',
      transform: [{ rotate: '20deg' }],
      borderRadius: 30,
   },

   content: {
      alignItems: 'center',
      maxWidth: 320,
      width: '100%',
   },
   accentLine: {
      width: 48,
      height: 4,
      backgroundColor: '#8A8A8A',
      marginBottom: 20,
   },
   title: {
      fontSize: 18,
      fontWeight: '900',
      color: '#FFFFFF',
      textAlign: 'center',
      letterSpacing: 2,
      marginBottom: 10,
   },
   subtitle: {
      fontSize: 12,
      color: '#8A8A8A',
      textAlign: 'center',
      letterSpacing: 0.5,
      lineHeight: 18,
      marginBottom: 36,
   },

   dotsContainer: {
      flexDirection: 'row',
      gap: 18,
      marginBottom: 44,
   },
   dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#5A5A5A',
      backgroundColor: 'transparent',
   },
   dotFilled: {
      backgroundColor: '#E8E8E8',
      borderColor: '#E8E8E8',
   },

   keypad: {
      width: '100%',
      gap: 16,
   },
   row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
   },
   key: {
      width: 70,
      height: 70,
      borderRadius: 4,
      backgroundColor: '#161616',
      borderWidth: 1,
      borderColor: '#2A2A2A',
      justifyContent: 'center',
      alignItems: 'center',
   },
   keyText: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
   },
   keyAction: {
      width: 70,
      height: 70,
      justifyContent: 'center',
      alignItems: 'center',
   },
   keyEmpty: {
      width: 70,
      height: 70,
   },
   actionText: {
      color: '#8A8A8A',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
   },

   // Botón "olvidé mi PIN"
   forgotBtn: {
      marginTop: 28,
      paddingVertical: 10,
      paddingHorizontal: 16,
   },
   forgotText: {
      color: '#8A8A8A',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      textAlign: 'center',
   },
});
