import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, Animated, Easing, Platform, AccessibilityInfo } from 'react-native';
import { X, Layers, Save } from 'lucide-react-native';
import { Shelf } from '../types/inventory';
import { updateShelf } from '../services/shelfService';
import { showAlert } from '../utils/alert';
import { C, box, label, btn, btnText, caps, overlay, modalCard } from '../theme';

interface EditShelfModalProps {
   shelf: Shelf | null;
   visible: boolean;
   onClose: () => void;
}

// Curva ease-out fuerte: arranca rápido y se siente inmediata
const ease = Easing.bezier(0.23, 1, 0.32, 1);
const nd = Platform.OS !== 'web';

export const EditShelfModal: React.FC<EditShelfModalProps> = ({ shelf, visible, onClose }) => {
   // ---- LÓGICA ORIGINAL (sin cambios) ----
   const [name, setName] = useState('');
   const [rowsCount, setRowsCount] = useState('1');
   const [spacesPerRow, setSpacesPerRow] = useState('3');
   const [submitting, setSubmitting] = useState(false);

   useEffect(() => {
      if (shelf) {
         setName(shelf.name || '');
         setRowsCount(String(shelf.rowsCount || 1));
         setSpacesPerRow(String(shelf.spacesPerRow || 3));
      }
   }, [shelf]);

   // ---- SOLO DISEÑO: foco, animación de entrada ----
   const [focused, setFocused] = useState<'name' | 'rows' | 'spaces' | null>(null);
   const card = useRef(new Animated.Value(0)).current;
   const items = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

   useEffect(() => {
      const all = [card, ...items];
      if (!visible) {
         all.forEach((v) => v.setValue(0)); // listo para la próxima apertura
         return;
      }
      AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
         if (reduce) {
            all.forEach((v) => v.setValue(1)); // sin movimiento si el usuario lo pidió
            return;
         }
         const t = (v: Animated.Value, d: number) =>
            Animated.timing(v, { toValue: 1, duration: d, easing: ease, useNativeDriver: nd });
         Animated.parallel([t(card, 240), Animated.stagger(50, items.map((v) => t(v, 220)))]).start();
      });
   }, [visible]);

   if (!shelf) return null;

   const handleSubmit = async () => {
      if (!name.trim()) {
         showAlert('Atención', 'El nombre del estante no puede estar vacío.');
         return;
      }

      const parsedRows = parseInt(rowsCount, 10) || 1;
      const parsedSpaces = parseInt(spacesPerRow, 10) || 3;

      try {
         setSubmitting(true);
         if (shelf.id) {
            await updateShelf(shelf.id, {
               name,
               rowsCount: parsedRows,
               spacesPerRow: parsedSpaces,
            });
         }
         onClose();
      } catch (error: any) {
         showAlert('Error', error.message || 'No se pudo actualizar el estante.');
      } finally {
         setSubmitting(false);
      }
   };

   // Datos para la vista previa (solo lectura de lo que escribe el usuario)
   const rows = Math.max(parseInt(rowsCount, 10) || 1, 1);
   const spaces = Math.max(parseInt(spacesPerRow, 10) || 3, 1);
   const shownRows = Math.min(rows, 6);
   const shownCols = Math.min(spaces, 8);
   const reveal = (v: Animated.Value) => ({
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
   });

   return (
      <Modal visible={visible} animationType="fade" transparent>
         <View style={styles.overlay}>
            <Animated.View
               style={[
                  styles.card,
                  {
                     opacity: card,
                     transform: [
                        { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                        { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                     ],
                  },
               ]}
            >
               <View style={styles.shape} />

               <View style={styles.header}>
                  <View>
                     <View style={styles.accentLine} />
                     <Text style={styles.title}>Editar Estante</Text>
                     <Text style={styles.subtitle}>Nombre y cuadrícula de la bodega</Text>
                  </View>
                  <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                     <X size={18} color={C.soft} />
                  </Pressable>
               </View>

               <View style={styles.body}>
                  <Animated.View style={reveal(items[0])}>
                     <Text style={styles.label}>Nombre de Estante *</Text>
                     <TextInput
                        style={[styles.input, styles.inputName, focused === 'name' && styles.inputFocused]}
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                        autoCapitalize="characters"
                        placeholder="Ej: RACK A, ESTANTE 2"
                        placeholderTextColor={C.dim}
                     />
                  </Animated.View>

                  <Animated.View style={[styles.rowInputs, reveal(items[1])]}>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Filas / Niveles</Text>
                        <TextInput
                           style={[styles.input, styles.inputNum, focused === 'rows' && styles.inputFocused]}
                           value={rowsCount}
                           onChangeText={setRowsCount}
                           onFocus={() => setFocused('rows')}
                           onBlur={() => setFocused(null)}
                           keyboardType="number-pad"
                           placeholder="1"
                           placeholderTextColor={C.dim}
                        />
                     </View>

                     <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Espacios p/ Fila</Text>
                        <TextInput
                           style={[styles.input, styles.inputNum, focused === 'spaces' && styles.inputFocused]}
                           value={spacesPerRow}
                           onChangeText={setSpacesPerRow}
                           onFocus={() => setFocused('spaces')}
                           onBlur={() => setFocused(null)}
                           keyboardType="number-pad"
                           placeholder="3"
                           placeholderTextColor={C.dim}
                        />
                     </View>
                  </Animated.View>

                  {/* Vista previa en vivo del estante */}
                  <Animated.View style={[styles.preview, reveal(items[2])]}>
                     <View style={styles.previewHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                           <Layers size={14} color={C.mute} style={{ marginRight: 6 }} />
                           <Text style={styles.previewTitle}>Vista previa</Text>
                        </View>
                        <Text style={styles.previewTotal}>
                           {rows * spaces} <Text style={styles.previewTotalSub}>espacios</Text>
                        </Text>
                     </View>

                     <View style={{ gap: 6 }}>
                        {Array.from({ length: shownRows }).map((_, r) => (
                           <View key={r} style={styles.rackRow}>
                              <Text style={styles.rackLabel}>F{shownRows - r}</Text>
                              {Array.from({ length: shownCols }).map((_, c) => (
                                 <View
                                    key={c}
                                    style={[styles.rackCell, r === shownRows - 1 && c === 0 && styles.rackCellOrigin]}
                                 />
                              ))}
                           </View>
                        ))}
                     </View>

                     {(rows > shownRows || spaces > shownCols) && (
                        <Text style={styles.previewNote}>Vista reducida de {rows} × {spaces}</Text>
                     )}
                  </Animated.View>
               </View>

               <View style={styles.footer}>
                  <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
                     <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                     onPress={handleSubmit}
                     disabled={submitting}
                     style={({ pressed }) => [styles.saveBtn, submitting && { opacity: 0.6 }, pressed && styles.pressed]}
                  >
                     <Save size={16} color={C.bg} />
                     <Text style={styles.saveText}>Guardar Cambios</Text>
                  </Pressable>
               </View>
            </Animated.View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay,
   card: { ...modalCard, maxWidth: 440 },
   shape: { position: 'absolute', top: -70, right: -70, width: 180, height: 180, backgroundColor: '#161616', borderRadius: 30, transform: [{ rotate: '35deg' }] },

   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 16 },
   accentLine: { width: 40, height: 4, backgroundColor: C.mute, marginBottom: 14 },
   title: { ...caps, fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: 3 },
   subtitle: { fontSize: 11, color: C.mute, letterSpacing: 1, marginTop: 6 },
   closeBtn: { ...box, padding: 8, borderColor: '#3A3A3A' },

   body: { paddingHorizontal: 20, gap: 16 },
   label,
   input: { ...box, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.white },
   inputName: { fontSize: 18, fontWeight: '900', letterSpacing: 3 },
   inputNum: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
   inputFocused: { borderColor: C.soft, backgroundColor: '#202020' },
   rowInputs: { flexDirection: 'row', gap: 12 },

   preview: { ...box, backgroundColor: '#0F0F0F', padding: 14 },
   previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   previewTitle: { ...caps, fontSize: 10, fontWeight: 'bold', color: C.mute },
   previewTotal: { fontSize: 20, fontWeight: '900', color: C.white },
   previewTotalSub: { ...caps, fontSize: 9, fontWeight: 'bold', color: C.mute },
   rackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
   rackLabel: { width: 22, fontSize: 9, fontWeight: '900', color: C.mute },
   rackCell: { flex: 1, height: 22, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, borderRadius: 2 },
   rackCellOrigin: { backgroundColor: C.light, borderColor: C.light },
   previewNote: { fontSize: 10, color: C.dim, marginTop: 10, letterSpacing: 1 },

   footer: { flexDirection: 'row', gap: 10, padding: 20, paddingTop: 18 },
   cancelBtn: { ...btn, flex: 1, borderWidth: 1, borderColor: '#3A3A3A' },
   cancelText: { ...btnText, color: C.soft },
   saveBtn: { ...btn, flex: 2, gap: 6, backgroundColor: C.light },
   saveText: { ...btnText, color: C.bg },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});