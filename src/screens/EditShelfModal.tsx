import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, Animated } from 'react-native';
import { X, Layers, Save } from 'lucide-react-native';
import { Shelf } from '../types/inventory';
import { updateShelf } from '../services/shelfService';
import { showAlert } from '../utils/alert';
import { MONO as T, display, ease, nd, reduced } from '../design';

interface EditShelfModalProps {
   shelf: Shelf | null;
   visible: boolean;
   onClose: () => void;
}

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

   // ---- SOLO DISEÑO: foco y animación de entrada ----
   const [focused, setFocused] = useState<'name' | 'rows' | 'spaces' | null>(null);
   const card = useRef(new Animated.Value(0)).current;
   const items = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

   useEffect(() => {
      const all = [card, ...items];
      if (!visible) {
         all.forEach((v) => v.setValue(0)); // listo para la próxima apertura
         return;
      }
      if (reduced()) {
         all.forEach((v) => v.setValue(1)); // sin movimiento si el usuario lo pidió
         return;
      }
      const t = (v: Animated.Value, d: number) =>
         Animated.timing(v, { toValue: 1, duration: d, easing: ease, useNativeDriver: nd });
      Animated.parallel([t(card, 240), Animated.stagger(50, items.map((v) => t(v, 220)))]).start();
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
               {/* Cabecera negra, como el banner del panel */}
               <View style={styles.header}>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.title}>Editar Estante</Text>
                     <Text style={styles.subtitle}>Nombre y cuadrícula de la bodega</Text>
                  </View>
                  <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                     <X size={18} color={T.onBar} />
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
                        placeholderTextColor={T.inkMute}
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
                           placeholderTextColor={T.inkMute}
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
                           placeholderTextColor={T.inkMute}
                        />
                     </View>
                  </Animated.View>

                  {/* Vista previa en vivo del estante */}
                  <Animated.View style={[styles.preview, reveal(items[2])]}>
                     <View style={styles.previewHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Layers size={15} color={T.inkSoft} />
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
                     <Save size={16} color={T.onSolid} />
                     <Text style={styles.saveText}>Guardar Cambios</Text>
                  </Pressable>
               </View>
            </Animated.View>
         </View>
      </Modal>
   );
};

const btn = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, height: 46, borderRadius: 10 };

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },

   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 20, backgroundColor: T.bar },
   title: { ...display, fontSize: 34, lineHeight: 34, fontWeight: '800', color: T.onBar, textTransform: 'uppercase' },
   subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
   closeBtn: { padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 10 },

   body: { padding: 20, gap: 16 },
   label: { fontSize: 13, fontWeight: '700', color: T.inkSoft, marginBottom: 6 },
   input: { borderWidth: 1, borderColor: T.line, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink },
   inputName: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
   inputNum: { ...display, fontSize: 32, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
   inputFocused: { borderColor: T.ink },
   rowInputs: { flexDirection: 'row', gap: 12 },

   preview: { backgroundColor: T.surface, borderRadius: 12, padding: 14 },
   previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   previewTitle: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
   previewTotal: { ...display, fontSize: 30, lineHeight: 30, fontWeight: '800', color: T.ink },
   previewTotalSub: { fontSize: 14, fontWeight: '600', color: T.inkMute },
   rackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
   rackLabel: { width: 24, fontSize: 10, fontWeight: '800', color: T.inkMute },
   rackCell: { flex: 1, height: 22, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line, borderRadius: 4 },
   rackCellOrigin: { backgroundColor: T.solid, borderColor: T.solid },
   previewNote: { fontSize: 11, color: T.inkMute, marginTop: 10 },

   footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
   cancelBtn: { ...btn, flex: 1, borderWidth: 1, borderColor: T.line },
   cancelText: { fontSize: 14, fontWeight: '700', color: T.ink },
   saveBtn: { ...btn, flex: 2, gap: 8, backgroundColor: T.solid },
   saveText: { fontSize: 14, fontWeight: '800', color: T.onSolid },
});
