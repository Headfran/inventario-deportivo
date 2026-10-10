import React, { useState } from 'react';
import {
   View,
   Text,
   Modal,
   StyleSheet,
   TouchableOpacity,
   Switch,
   TextInput,
   ScrollView,
} from 'react-native';
import { Printer, X, FileText, DollarSign, CheckCircle2 } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { generateCatalogPrint } from '../utils/printCatalog';

interface Props {
   products: Product[];
   visible: boolean;
   onClose: () => void;
   activeCategoryName?: string;
}

export const CatalogPrintModal: React.FC<Props> = ({
   products,
   visible,
   onClose,
   activeCategoryName,
}) => {
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
               {/* ENCABEZADO */}
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Printer size={20} color="#2563eb" />
                     <Text style={styles.title}>Exportar / Imprimir Catálogo</Text>
                  </View>
                  <TouchableOpacity onPress={onClose}>
                     <X size={20} color="#64748b" />
                  </TouchableOpacity>
               </View>

               <ScrollView style={styles.body}>
                  <View style={styles.summaryBanner}>
                     <CheckCircle2 size={18} color="#2563eb" style={{ marginRight: 8 }} />
                     <Text style={styles.summaryText}>
                        Se incluirán <Text style={{ fontWeight: 'bold' }}>{products.length}</Text> prendas
                        {activeCategoryName && activeCategoryName !== 'all'
                           ? ` de la categoría "${activeCategoryName}"`
                           : ' del filtro actual'}
                        .
                     </Text>
                  </View>

                  {/* OPCIÓN CON O SIN PRECIOS */}
                  <View style={styles.optionRow}>
                     <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <DollarSign size={16} color="#16a34a" />
                           <Text style={styles.optionTitle}>Mostrar Precios de Venta</Text>
                        </View>
                        <Text style={styles.optionDescription}>
                           Desactívalo si deseas imprimir un catálogo publicitario para muestras o proveedores sin mostrar tus precios.
                        </Text>
                     </View>
                     <Switch
                        value={showPrices}
                        onValueChange={setShowPrices}
                        trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                        thumbColor={showPrices ? '#2563eb' : '#f1f5f9'}
                     />
                  </View>

                  {/* NOMBRE DE LA TIENDA EN EL ENCABEZADO */}
                  <Text style={styles.label}>Nombre de la Tienda / Marca en el documento:</Text>
                  <TextInput
                     style={styles.input}
                     value={storeName}
                     onChangeText={setStoreName}
                     placeholder="Ej: Boutique Elegance"
                     placeholderTextColor="#94a3b8"
                  />

                  {/* NOTA O SUBTÍTULO ADICIONAL */}
                  <Text style={styles.label}>Nota o mensaje al pie de cabecera (Opcional):</Text>
                  <TextInput
                     style={styles.input}
                     value={customSubtitle}
                     onChangeText={setCustomSubtitle}
                     placeholder="Ej: Colección Temporada Invierno / Promoción"
                     placeholderTextColor="#94a3b8"
                  />
               </ScrollView>

               {/* ACCIONES */}
               <View style={styles.footer}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                     <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.printBtn} onPress={handleTriggerPrint}>
                     <FileText size={16} color="#ffffff" style={{ marginRight: 6 }} />
                     <Text style={styles.printBtnText}>Generar Vista / PDF</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   title: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   body: { padding: 16 },
   summaryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 16 },
   summaryText: { fontSize: 12, color: '#1e40af', flex: 1 },
   optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 16 },
   optionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   optionDescription: { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 16 },
   label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
   input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 13, color: '#0f172a', marginBottom: 12 },
   footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
   cancelBtnText: { color: '#475569', fontSize: 13, fontWeight: 'bold' },
   printBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
   printBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});
