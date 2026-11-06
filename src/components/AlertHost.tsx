import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { subscribeToAlerts, dismissCurrentAlert, AlertRequest } from '../utils/alert';
import { MONO as T, display } from '../design';

const DANGER_PATTERN = /eliminar|borrar|anular|cerrar\s*sesi[oó]n|rechazar|descartar/i;

export const AlertHost: React.FC = () => {
   const [req, setReq] = useState<AlertRequest | null>(null);

   useEffect(() => {
      return subscribeToAlerts(setReq);
   }, []);

   if (!req) return null;

   const isDanger = DANGER_PATTERN.test(req.title);

   const handleConfirm = () => {
      const cb = req.onConfirm;
      dismissCurrentAlert();
      if (cb) setTimeout(cb, 50);
   };

   const handleCancel = () => {
      const cb = req.onCancel;
      dismissCurrentAlert();
      if (cb) setTimeout(cb, 50);
   };

   return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
         <View style={styles.overlay}>
            <Pressable
               style={StyleSheet.absoluteFill}
               onPress={req.type === 'confirm' ? handleCancel : handleConfirm}
            />
            <View style={styles.card}>
               <View style={[styles.header, isDanger && styles.headerDanger]}>
                  {isDanger ? (
                     <AlertCircle size={22} color={T.onBar} />
                  ) : (
                     <CheckCircle2 size={22} color={T.onBar} />
                  )}
                  <Text style={styles.title} numberOfLines={2}>
                     {req.title}
                  </Text>
               </View>

               {req.message && (
                  <View style={styles.body}>
                     <Text style={styles.message}>{req.message}</Text>
                  </View>
               )}

               <View style={styles.footer}>
                  {req.type === 'confirm' && (
                     <Pressable
                        style={({ pressed }) => [styles.btnCancel, pressed && styles.pressed]}
                        onPress={handleCancel}
                     >
                        <Text style={styles.btnCancelText}>Cancelar</Text>
                     </Pressable>
                  )}
                  <Pressable
                     style={({ pressed }) => [
                        styles.btnPrimary,
                        isDanger && styles.btnPrimaryDanger,
                        pressed && styles.pressed,
                     ]}
                     onPress={handleConfirm}
                  >
                     <Text style={styles.btnPrimaryText}>
                        {req.type === 'confirm' ? (isDanger ? 'Confirmar' : 'Aceptar') : 'OK'}
                     </Text>
                  </Pressable>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: {
      flex: 1,
      backgroundColor: 'rgba(10,10,10,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
   },
   card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: T.bg,
      borderRadius: 16,
      overflow: 'hidden',
   },
   header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 16,
      backgroundColor: T.bar,
   },
   headerDanger: {
      backgroundColor: '#7F1D1D',
   },
   title: {
      ...display,
      flex: 1,
      fontSize: 18,
      lineHeight: 20,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
   },
   body: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 4,
   },
   message: {
      fontSize: 14,
      lineHeight: 20,
      color: T.inkSoft,
   },
   footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      padding: 16,
   },
   btnCancel: {
      height: 42,
      paddingHorizontal: 18,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.line,
      alignItems: 'center',
      justifyContent: 'center',
   },
   btnCancelText: {
      fontSize: 13,
      fontWeight: '700',
      color: T.ink,
   },
   btnPrimary: {
      height: 42,
      paddingHorizontal: 22,
      borderRadius: 10,
      backgroundColor: T.solid,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 88,
   },
   btnPrimaryDanger: {
      backgroundColor: '#DC2626',
   },
   btnPrimaryText: {
      fontSize: 13,
      fontWeight: '800',
      color: T.onSolid,
   },
   pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
   },
});
