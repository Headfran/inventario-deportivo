import React, { useState, useEffect } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   StyleSheet,
   Modal
} from 'react-native';
import { X, Layers, Save } from 'lucide-react-native';
import { Shelf } from '../types/inventory';
import { updateShelf } from '../services/shelfService';
import { showAlert } from '../utils/alert';

interface EditShelfModalProps {
   shelf: Shelf | null;
   visible: boolean;
   onClose: () => void;
}

export const EditShelfModal: React.FC<EditShelfModalProps> = ({
   shelf,
   visible,
   onClose,
}) => {
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

   return (
      <Modal visible={visible} animationType="fade" transparent>
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={styles.titleRow}>
                     <Layers size={20} color="#2563eb" style={{ marginRight: 8 }} />
                     <Text style={styles.title}>Editar Estante</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                     <X size={20} color="#64748b" />
                  </TouchableOpacity>
               </View>

               <View style={styles.body}>
                  <Text style={styles.label}>Nombre de Estante *</Text>
                  <TextInput
                     style={styles.input}
                     value={name}
                     onChangeText={setName}
                     autoCapitalize="characters"
                     placeholder="Ej: RACK A, ESTANTE 2"
                  />

                  <View style={styles.rowInputs}>
                     <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Filas / Niveles</Text>
                        <TextInput
                           style={styles.input}
                           value={rowsCount}
                           onChangeText={setRowsCount}
                           keyboardType="number-pad"
                           placeholder="1"
                        />
                     </View>

                     <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Espacios p/ Fila</Text>
                        <TextInput
                           style={styles.input}
                           value={spacesPerRow}
                           onChangeText={setSpacesPerRow}
                           keyboardType="number-pad"
                           placeholder="3"
                        />
                     </View>
                  </View>
               </View>

               <View style={styles.footer}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                     <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={styles.saveBtn}
                     onPress={handleSubmit}
                     disabled={submitting}
                  >
                     <Save size={16} color="#ffffff" style={{ marginRight: 6 }} />
                     <Text style={styles.saveText}>Guardar Cambios</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
   },
   card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 20,
   },
   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      paddingBottom: 12,
   },
   titleRow: { flexDirection: 'row', alignItems: 'center' },
   title: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
   body: { marginVertical: 16, gap: 12 },
   label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 },
   input: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: '#0f172a',
   },
   rowInputs: { flexDirection: 'row', gap: 12 },
   footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
   cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
   cancelText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
   saveBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
   saveText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
});
