import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Switch, TextInput, ScrollView } from 'react-native';
import { Printer, X, FileText, DollarSign, CheckCircle2 } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { generateCatalogPrint } from '../utils/printCatalog';
import { C, caps, box, label, btn, btnText, overlay, modalCard } from '../theme';

interface Props {
   products: Product[];
   visible: boolean;
   onClose: () => void;
   activeCategoryName?: string;
}

export const CatalogPrintModal: React.FC<Props> = ({ products, visible, onClose, activeCategoryName }) => {
   const [showPrices, setShowPrices] = useState(true);
   const [storeName, setStoreName] = useState('Mi Tienda de Ropa');
   const [customSubtitle, setCustomSubtitle] = useState('');

   const handleTriggerPrint = () => {
      generateCatalogPrint(products, {
         showPrices,
         storeName,
         categoryFilterName: activeCategoryName !== 'all' ? activeCategoryName : undefined,
         subtitle: customSubtitle || undefined,
      });
      onClose();
   };

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Printer size={20} color={C.light} />
                     <Text style={styles.title}>Exportar / Imprimir Catálogo</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                     <X size={20} color={C.soft} />
                  </TouchableOpacity>
               </View>

               <ScrollView style={{ padding: 16 }}>
                  <View style={styles.summaryBanner}>
                     <CheckCircle2 size={18} color={C.light} style={{ marginRight: 8 }} />
                     <Text style={styles.summaryText}>
                        Se incluirán <Text style={{ fontWeight: 'bold', color: C.white }}>{products.length}</Text> prendas
                        {activeCategoryName && activeCategoryName !== 'all'
                           ? ` de la categoría "${activeCategoryName}"`
                           : ' del filtro actual'}
                        .
                     </Text>
                  </View>

                  <View style={styles.optionRow}>
                     <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <DollarSign size={16} color={C.soft} />
                           <Text style={styles.optionTitle}>Mostrar Precios de Venta</Text>
                        </View>
                        <Text style={styles.optionDescription}>
                           Desactívalo si deseas imprimir un catálogo publicitario para muestras o proveedores sin mostrar tus precios.
                        </Text>
                     </View>
                     <Switch
                        value={showPrices}
                        onValueChange={setShowPrices}
                        trackColor={{ false: C.line, true: C.mute }}
                        thumbColor={showPrices ? C.light : C.dim}
                     />
                  </View>

                  <Text style={styles.label}>Nombre de la Tienda / Marca en el documento:</Text>
                  <TextInput
                     style={styles.input}
                     value={storeName}
                     onChangeText={setStoreName}
                     placeholder="Ej: Boutique Elegance"
                     placeholderTextColor={C.dim}
                  />

                  <Text style={styles.label}>Nota o mensaje al pie de cabecera (Opcional):</Text>
                  <TextInput
                     style={styles.input}
                     value={customSubtitle}
                     onChangeText={setCustomSubtitle}
                     placeholder="Ej: Colección Temporada Invierno / Promoción"
                     placeholderTextColor={C.dim}
                  />
               </ScrollView>

               <View style={styles.footer}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                     <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.printBtn} onPress={handleTriggerPrint}>
                     <FileText size={16} color={C.bg} style={{ marginRight: 6 }} />
                     <Text style={styles.printText}>Generar Vista / PDF</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay,
   card: modalCard,
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: C.border },
   title: { ...caps, fontSize: 13, fontWeight: '900', color: C.white },
   summaryBanner: { ...box, flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 16 },
   summaryText: { fontSize: 12, color: C.soft, flex: 1 },
   optionRow: { ...box, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, marginBottom: 16 },
   optionTitle: { fontSize: 13, fontWeight: 'bold', color: C.white },
   optionDescription: { fontSize: 11, color: C.mute, marginTop: 2, lineHeight: 16 },
   label,
   input: { ...box, paddingHorizontal: 12, height: 40, fontSize: 13, color: C.white, marginBottom: 12 },
   footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: C.border },
   cancelBtn: { ...btn, paddingHorizontal: 16, borderWidth: 1, borderColor: '#3A3A3A' },
   cancelText: { ...btnText, color: C.soft },
   printBtn: { ...btn, paddingHorizontal: 16, backgroundColor: C.light },
   printText: { ...btnText, color: C.bg },
});