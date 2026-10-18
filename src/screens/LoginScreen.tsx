import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

// Paleta de diseño (un solo lugar para cambiar colores)
const C = {
   bg: '#0A0A0A',
   surface: '#121212',
   raised: '#1A1A1A',
   border: '#262626',
   line: '#2E2E2E',
   white: '#FFFFFF',
   light: '#E8E8E8',
   soft: '#BDBDBD',
   mute: '#8A8A8A',
   dim: '#5A5A5A',
};

export const LoginScreen = () => {
   // ---- LÓGICA ORIGINAL (sin cambios) ----
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const { login } = useAuth();

   const handleLogin = async () => {
      if (!email.trim() || !password.trim()) {
         Alert.alert('Error', 'Por favor ingresa tu correo y contraseña');
         return;
      }

      try {
         setSubmitting(true);
         await login(email, password);
      } catch (error: any) {
         Alert.alert('Error al iniciar sesión', error.message || 'Credenciales inválidas');
      } finally {
         setSubmitting(false);
      }
   };

   // ---- SOLO DISEÑO (estados visuales) ----
   const [focused, setFocused] = useState<'email' | 'password' | null>(null);
   const [showPass, setShowPass] = useState(false);

   const fade = useRef(new Animated.Value(0)).current;
   const slide = useRef(new Animated.Value(30)).current;

   useEffect(() => {
      Animated.parallel([
         Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
         Animated.timing(slide, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
   }, []);

   return (
      <KeyboardAvoidingView
         style={styles.container}
         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
         <StatusBar barStyle="light-content" backgroundColor={C.bg} />

         {/* Formas decorativas */}
         <View style={styles.shapeBig} />
         <View style={styles.shapeSmall} />

         <Animated.View
            style={[styles.content, { opacity: fade, transform: [{ translateY: slide }] }]}
         >
            <View style={styles.brandBlock}>
               <View style={styles.accentLine} />
               <Text style={styles.title}>ACCESO AL PERSONAL</Text>
               <Text style={styles.subtitle}>SISTEMA DE INVENTARIO & VENTAS</Text>
            </View>

            <View style={styles.card}>
               <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
               <TextInput
                  style={[styles.input, focused === 'email' && styles.inputFocused]}
                  placeholder="vendedor@tienda.com"
                  placeholderTextColor={C.dim}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
               />

               <Text style={[styles.label, { marginTop: 20 }]}>CONTRASEÑA</Text>
               <View>
                  <TextInput
                     style={[styles.input, focused === 'password' && styles.inputFocused]}
                     placeholder="••••••••"
                     placeholderTextColor={C.dim}
                     value={password}
                     onChangeText={setPassword}
                     onFocus={() => setFocused('password')}
                     onBlur={() => setFocused(null)}
                     secureTextEntry={!showPass}
                  />
                  <TouchableOpacity style={styles.eye} onPress={() => setShowPass(!showPass)}>
                     <Text style={styles.eyeText}>{showPass ? 'OCULTAR' : 'VER'}</Text>
                  </TouchableOpacity>
               </View>

               <TouchableOpacity
                  style={[styles.button, submitting && { opacity: 0.6 }]}
                  onPress={handleLogin}
                  disabled={submitting}
                  activeOpacity={0.85}
               >
                  {submitting ? (
                     <ActivityIndicator color={C.bg} />
                  ) : (
                     <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
                  )}
               </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Acceso exclusivo para personal autorizado</Text>
         </Animated.View>
      </KeyboardAvoidingView>
   );
};

// Base de las formas decorativas (evita repetir estilos)
const shapeBase = {
   position: 'absolute' as const,
   transform: [{ rotate: '35deg' }],
};

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: C.bg,
      justifyContent: 'center',
      overflow: 'hidden',
   },
   content: {
      paddingHorizontal: 28,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
   },

   // Decoración
   shapeBig: {
      ...shapeBase,
      top: -120,
      right: -140,
      width: 340,
      height: 340,
      backgroundColor: '#161616',
      borderRadius: 40,
   },
   shapeSmall: {
      ...shapeBase,
      bottom: -90,
      left: -100,
      width: 240,
      height: 240,
      backgroundColor: '#1C1C1C',
      borderRadius: 30,
      transform: [{ rotate: '20deg' }],
   },

   // Encabezado
   brandBlock: { marginBottom: 36 },
   accentLine: {
      width: 48,
      height: 4,
      backgroundColor: C.mute,
      marginBottom: 18,
   },
   title: {
      color: C.white,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 3,
   },
   subtitle: {
      color: C.mute,
      fontSize: 11,
      letterSpacing: 3,
      marginTop: 8,
   },

   // Tarjeta
   card: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 4,
      padding: 24,
   },
   label: {
      color: C.mute,
      fontSize: 11,
      letterSpacing: 2,
      marginBottom: 8,
   },
   input: {
      backgroundColor: C.raised,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 2,
      color: C.white,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
   },
   inputFocused: {
      borderColor: C.soft,
      backgroundColor: '#202020',
   },
   eye: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
   },
   eyeText: {
      color: C.mute,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
   },

   // Botón
   button: {
      backgroundColor: C.light,
      borderRadius: 2,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 28,
   },
   buttonText: {
      color: C.bg,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 3,
   },

   footer: {
      color: '#4A4A4A',
      fontSize: 11,
      textAlign: 'center',
      marginTop: 28,
      letterSpacing: 1,
   },
});