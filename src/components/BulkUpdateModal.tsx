import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { X, Save, DollarSign, Layers } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { updateProduct } from '../services/productService';
import { showAlert } from '../utils/alert';

interface Props { selectedProducts: Product[]; visible: boolean; onClose: () => void; onComplete: () => void; }

export const BulkUpdateModal: React.FC<Props> = ({ selectedProducts, visible, onClose, onComplete }) => {
   const [loading, setLoading] = useState(false);
   const [mode, setMode] = useState<'price' | 'stock'>('price');
   const [newPrice, setNewPrice] = useState('');
   const [variantColor, setVariantColor] = useState('');
   const [variantSize, setVariantSize] = useState('');
   const [variantStock, setVariantStock] = useState('');

   const handleApply = async () => {
      if (mode === 'price' && !newPrice) return showAlert('Error', 'Ingresa un precio válido');
      if (mode === 'stock' && (!variantColor || !variantSize || !variantStock)) return showAlert('Error', 'Completa color, talla y cantidad');

      setLoading(true);
      try {
         const updates = selectedProducts.map(async (p) => {
            if (!p.id) return;
            const updated = JSON.parse(JSON.stringify(p)) as Product;

            if (mode === 'price') {
               updated.price = parseFloat(newPrice);
            } else if (mode === 'stock') {
               const colorName = variantColor.trim(); const sizeName = variantSize.trim().toUpperCase(); const stockVal = parseInt(variantStock, 10);
               const vIndex = updated.variants.findIndex(v => v.color.toLowerCase() === colorName.toLowerCase());
               if (vIndex >= 0) {
                  const sIndex = updated.variants[vIndex].sizes.findIndex(s => s.size === sizeName);
                  if (sIndex >= 0) updated.variants[vIndex].sizes[sIndex].stock = stockVal;
                  else updated.variants[vIndex].sizes.push({ size: sizeName, stock: stockVal });
               } else {
                  updated.variants.push({ id: `var_${Date.now()}`, color: colorName, colorHex: '#cbd5e1', sizes: [{ size: sizeName, stock: stockVal }], locations: [], exhibition: { isOnDisplay: false } });
               }
            }
            await updateProduct(p.id, updated);
         });
         await Promise.all(updates);
         showAlert('Éxito', `Se actualizaron ${selectedProducts.length} prendas correctamente.`);
         onComplete();
      } catch (error: any) { showAlert('Error', error.message); } finally { setLoading(false); }
   };

   return (
      <Modal visible={visible} transparent animationType="fade">
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <Text style={styles.title}>Actualización Masiva ({selectedProducts.length} prendas)</Text>
                  <TouchableOpacity onPress={onClose}><X size={20} color="#64748b" /></TouchableOpacity>
               </View>
               <View style={styles.modeTabs}>
                  <TouchableOpacity style={[styles.tab, mode === 'price' && styles.tabActive]} onPress={() => setMode('price')}><DollarSign size={16} color={mode === 'price' ? '#2563eb' : '#64748b'} /><Text style={[styles.tabText, mode === 'price' && styles.tabTextActive]}>Precio</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tab, mode === 'stock' && styles.tabActive]} onPress={() => setMode('stock')}><Layers size={16} color={mode === 'stock' ? '#2563eb' : '#64748b'} /><Text style={[styles.tabText, mode === 'stock' && styles.tabTextActive]}>Inyectar Stock / Talla</Text></TouchableOpacity>
               </View>
               <ScrollView style={styles.body}>
                  {mode === 'price' ? (
                     <View>
                        <Text style={styles.label}>Nuevo Precio General ($):</Text>
                        <TextInput style={styles.input} placeholder="Ej. 25.50" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" />
                        <Text style={styles.hint}>Todas las prendas seleccionadas pasarán a tener este precio de venta.</Text>
                     </View>
                  ) : (
                     <View>
                        <Text style={styles.label}>Color a modificar/crear:</Text>
                        <TextInput style={styles.input} placeholder="Ej. Negro, Blanco, Azul..." value={variantColor} onChangeText={setVariantColor} />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                           <View style={{ flex: 1 }}><Text style={styles.label}>Talla:</Text><TextInput style={styles.input} placeholder="M, L, 40..." value={variantSize} onChangeText={setVariantSize} autoCapitalize="characters" /></View>
                           <View style={{ flex: 1 }}><Text style={styles.label}>Nuevo Stock:</Text><TextInput style={styles.input} placeholder="Cant..." value={variantStock} onChangeText={setVariantStock} keyboardType="numeric" /></View>
                        </View>
                        <Text style={styles.hint}>Si el color/talla existe en la prenda, se actualiza la cantidad. Si no existe, se creará la variante automáticamente.</Text>
                     </View>
                  )}
               </ScrollView>
               <View style={styles.footer}>
                  <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={loading}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnApply} onPress={handleApply} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <><Save size={16} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnApplyText}>Aplicar a {selectedProducts.length}</Text></>}</TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};
const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   title: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
   modeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
   tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb', backgroundColor: '#f8fafc' },
   tabText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' }, tabTextActive: { color: '#2563eb' },
   body: { padding: 16 },
   label: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
   input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 16 },
   hint: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: -8 },
   footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
   btnCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center' },
   btnCancelText: { fontWeight: 'bold', color: '#475569' },
   btnApply: { flex: 2, flexDirection: 'row', paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
   btnApplyText: { fontWeight: 'bold', color: '#ffffff' },
});
