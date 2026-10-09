import React, { useState } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   StyleSheet,
   ActivityIndicator,
   Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const LoginScreen = () => {
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

   return (
      <View style={styles.container}>
         <View style={styles.card}>
            <Text style={styles.title}>Acceso al Personal</Text>
            <Text style={styles.subtitle}>Sistema de Inventario & Ventas</Text>

            <TextInput
               style={styles.input}
               placeholder="Correo electrónico"
               value={email}
               onChangeText={setEmail}
               autoCapitalize="none"
               keyboardType="email-address"
            />

            <TextInput
               style={styles.input}
               placeholder="Contraseña"
               value={password}
               onChangeText={setPassword}
               secureTextEntry
            />

            <TouchableOpacity
               style={styles.button}
               onPress={handleLogin}
               disabled={submitting}
            >
               {submitting ? (
                  <ActivityIndicator color="#fff" />
               ) : (
                  <Text style={styles.buttonText}>Iniciar Sesión</Text>
               )}
            </TouchableOpacity>
         </View>
      </View>
   );
};

const styles = StyleSheet.create({
   container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      padding: 20,
   },
   card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: '#ffffff',
      padding: 28,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
   },
   title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#0f172a',
      textAlign: 'center',
   },
   subtitle: {
      fontSize: 14,
      color: '#64748b',
      textAlign: 'center',
      marginBottom: 24,
   },
   input: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      marginBottom: 16,
   },
   button: {
      backgroundColor: '#2563eb',
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
   },
   buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
   },
});
