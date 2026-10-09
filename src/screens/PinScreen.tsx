import React, { useState } from 'react';
import {
   View,
   Text,
   TouchableOpacity,
   StyleSheet,
   Alert
} from 'react-native';

interface PinScreenProps {
   mode: 'SETUP' | 'UNLOCK';
   onSuccess: (pin?: string) => void;
   onCancelLogin?: () => void;
}

export const PinScreen: React.FC<PinScreenProps> = ({ mode, onSuccess, onCancelLogin }) => {
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

   return (
      <View style={styles.container}>
         <View style={styles.content}>
            <Text style={styles.title}>
               {mode === 'SETUP' ? 'Crea un PIN de Acceso Rápido' : 'Ingresa tu PIN de Acceso'}
            </Text>
            <Text style={styles.subtitle}>
               {mode === 'SETUP'
                  ? 'Este PIN de 4 dígitos te permitirá desbloquear la app rápidamente'
                  : 'Ingresa los 4 dígitos para continuar'}
            </Text>

            {/* Indicadores de PIN */}
            <View style={styles.dotsContainer}>
               {[0, 1, 2, 3].map((index) => (
                  <View
                     key={index}
                     style={[
                        styles.dot,
                        pin.length > index && styles.dotFilled
                     ]}
                  />
               ))}
            </View>

            {/* Teclado numérico */}
            <View style={styles.keypad}>
               {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
                  <View key={rIdx} style={styles.row}>
                     {row.map((num) => (
                        <TouchableOpacity
                           key={num}
                           style={styles.key}
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
                        <Text style={styles.actionText}>Salir</Text>
                     </TouchableOpacity>
                  ) : (
                     <View style={styles.keyEmpty} />
                  )}

                  <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('0')}>
                     <Text style={styles.keyText}>0</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.keyAction} onPress={handleDelete}>
                     <Text style={styles.actionText}>Borrar</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </View>
   );
};

const styles = StyleSheet.create({
   container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f172a',
      padding: 20,
   },
   content: {
      alignItems: 'center',
      maxWidth: 320,
      width: '100%',
   },
   title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: 8,
   },
   subtitle: {
      fontSize: 13,
      color: '#94a3b8',
      textAlign: 'center',
      marginBottom: 32,
   },
   dotsContainer: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 40,
   },
   dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#3b82f6',
      backgroundColor: 'transparent',
   },
   dotFilled: {
      backgroundColor: '#3b82f6',
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
      borderRadius: 35,
      backgroundColor: '#1e293b',
      justifyContent: 'center',
      alignItems: 'center',
   },
   keyText: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '600',
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
      color: '#94a3b8',
      fontSize: 14,
      fontWeight: '500',
   },
});
