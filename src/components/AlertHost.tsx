import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, TextInput, Platform } from 'react-native';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react-native';
import { subscribeToAlerts, dismissCurrentAlert, AlertRequest } from '../utils/alert';
import { MONO as T, display } from '../design';

const DANGER_PATTERN = /eliminar|borrar|anular|cerrar\s*sesi[oó]n|rechazar|descartar/i;

export const AlertHost: React.FC = () => {
   const [req, setReq] = useState<AlertRequest | null>(null);
   const [inputValue, setInputValue] = useState('');

   useEffect(() => {
      return subscribeToAlerts(setReq);
   }, []);

   // Resetear el input cada vez que cambia la alerta
   useEffect(() => {
      setInputValue('');
   }, [req?.id]);

   if (!req) return null;

   const isDanger = DANGER_PATTERN.test(req.title);
   const requiresText = req.type === 'confirmWithText';
   const expectedText = req.confirmText || '';
   const matchesText = !requiresText || inputValue.trim() === expectedText;
   const canConfirm = matchesText;

   const handleConfirm = () => {
      if (!canConfirm) return;
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
               onPress={req.type === 'alert' ? handleConfirm : handleCancel}
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

               {requiresText && (
                  <View style={styles.inputSection}>
                     <Text style={styles.inputHint}>
                        Escribe{' '}
                        <Text style={styles.inputExpected}>{expectedText}</Text>{' '}
                        para confirmar:
                     </Text>
                     <TextInput
                        style={styles.input}
                        value={inputValue}
                        onChangeText={setInputValue}
                        placeholder={req.inputPlaceholder}
                        placeholderTextColor={T.inkMute}
                        autoFocus
                        autoCapitalize="characters"
                        autoCorrect={false}
                        spellCheck={false}
                        {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
                     />
                  </View>
               )}

               <View style={styles.footer}>
                  {req.type !== 'alert' && (
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
                        !canConfirm && styles.btnPrimaryDisabled,
                        pressed && canConfirm && styles.pressed,
                     ]}
                     onPress={handleConfirm}
                     disabled={!canConfirm}
                  >
                     {isDanger && canConfirm && <Trash2 size={14} color={T.onSolid} />}
                     <Text style={styles.btnPrimaryText}>
                        {req.type === 'alert'
                           ? 'OK'
                           : isDanger
                              ? 'Sí, Eliminar'
                              : 'Confirmar'}
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
      maxWidth: 420,
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
   inputSection: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 4,
   },
   inputHint: {
      fontSize: 12,
      fontWeight: '600',
      color: T.inkSoft,
      marginBottom: 8,
      lineHeight: 16,
   },
   inputExpected: {
      fontWeight: '800',
      color: '#DC2626',
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
   },
   input: {
      borderWidth: 1.5,
      borderColor: T.line,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 0,
      height: 46,
      fontSize: 15,
      fontWeight: '700',
      color: T.ink,
      backgroundColor: T.bg,
      textAlignVertical: 'center',
      letterSpacing: 0.5,
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 42,
      paddingHorizontal: 22,
      borderRadius: 10,
      backgroundColor: T.solid,
      minWidth: 100,
   },
   btnPrimaryDanger: {
      backgroundColor: '#DC2626',
   },
   btnPrimaryDisabled: {
      opacity: 0.35,
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
