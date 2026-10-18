import React, { useState, useEffect, useRef } from 'react';
import {
   View, Text, Modal, StyleSheet, TouchableOpacity, Switch,
   TextInput, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { Printer, X, FileText, DollarSign, CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { generateCatalogPrint, CatalogPrintProgress } from '../utils/printCatalog';
import Constants from 'expo-constants';

interface Props {
   products: Product[];
   visible: boolean;
   onClose: () => void;
   activeCategoryName?: string;
}

const formatElapsed = (seconds: number): string => {
   if (seconds < 60) return `${seconds}s`;
   const m = Math.floor(seconds / 60);
   const s = seconds % 60;
   return `${m}m ${s}s`;
};

export const CatalogPrintModal: React.FC<Props> = ({
   products, visible, onClose, activeCategoryName,
}) => {
   const [showPrices, setShowPrices] = useState(true);
   const [storeName, setStoreName] = useState('Mi Tienda de Ropa');
   const [customSubtitle, setCustomSubtitle] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [progress, setProgress] = useState<CatalogPrintProgress | null>(null);
   const [elapsed, setElapsed] = useState(0);
   const cancelRef = useRef(false);

   const isExpoGo = Platform.OS !== 'web' && (
      Constants?.executionEnvironment === 'storeClient' ||
      String((Constants as any)?.executionEnvironment || '').toLowerCase().includes('storeclient')
   );

   // Timer de tiempo transcurrido
   useEffect(() => {
      if (!isGenerating) {
         setElapsed(0);
         return;
      }
      setElapsed(0);
      const t = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(t);
   }, [isGenerating]);

   // Reset al cerrar
   useEffect(() => {
      if (!visible) {
         setIsGenerating(false);
         setErrorMsg(null);
         setProgress(null);
         cancelRef.current = false;
      }
   }, [visible]);

   const handleTriggerPrint = async () => {
      setErrorMsg(null);
      setIsGenerating(true);
      setProgress({ phase: 'starting', done: 0, total: 0, message: 'Iniciando…' });
      cancelRef.current = false;

      try {
         if (typeof generateCatalogPrint !== 'function') {
            throw new Error('generateCatalogPrint no está disponible.');
         }

         await generateCatalogPrint(
            products,
            {
               showPrices,
               storeName: storeName.trim() || 'Catálogo',
               categoryFilterName: activeCategoryName !== 'all' ? activeCategoryName : undefined,
               subtitle: customSubtitle.trim() || undefined,
            },
            {
               onProgress: (p) => setProgress(p),
               shouldCancel: () => cancelRef.current,
            }
         );

         if (!cancelRef.current) onClose();
      } catch (err: any) {
         console.error('[CatalogModal] Error:', err);
         const msg = err?.message || String(err) || 'Error desconocido';
         setErrorMsg(msg);
         if (Platform.OS === 'web') {
            try { window.alert(`Error al generar catálogo:\n\n${msg}`); } catch { /* noop */ }
         }
      } finally {
         setIsGenerating(false);
         setProgress(null);
      }
   };

   const handleCancel = () => {
      cancelRef.current = true;
      // Feedback inmediato
      setProgress((prev) =>
         prev ? { ...prev, message: 'Cancelando…' } : prev
      );
   };

   const percent =
      progress && progress.total > 0
         ? Math.min(100, Math.round((progress.done / progress.total) * 100))
         : 0;

   const showLongWarning = products.length > 30;

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Printer size={20} color="#2563eb" />
                     <Text style={styles.title}>Exportar / Imprimir Catálogo</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} disabled={isGenerating}>
                     <X size={20} color={isGenerating ? '#cbd5e1' : '#64748b'} />
                  </TouchableOpacity>
               </View>

               {/* 🔧 PROGRESO VISIBLE SIEMPRE — fuera del ScrollView */}
               {isGenerating && (
                  <View style={styles.progressCardFloating}>
                     <View style={styles.progressHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                           <ActivityIndicator size="small" color="#2563eb" />
                           <Text style={styles.progressLabel} numberOfLines={1}>
                              {progress?.message || 'Preparando…'}
                           </Text>
                        </View>
                        <Text style={styles.progressTimer}>{formatElapsed(elapsed)}</Text>
                     </View>

                     {progress && progress.total > 0 && (
                        <>
                           <View style={styles.progressBar}>
                              <View style={[styles.progressFill, { width: `${percent}%` }]} />
                           </View>
                           <View style={styles.progressFooter}>
                              <Text style={styles.progressCounter}>
                                 {progress.done} / {progress.total} ({percent}%)
                              </Text>
                              <TouchableOpacity
                                 style={styles.cancelProgressBtn}
                                 onPress={handleCancel}
                                 disabled={cancelRef.current}
                              >
                                 <Text style={styles.cancelProgressText}>
                                    {cancelRef.current ? 'Cancelando…' : 'Cancelar'}
                                 </Text>
                              </TouchableOpacity>
                           </View>
                        </>
                     )}

                     {(!progress || progress.total === 0) && (
                        <Text style={styles.progressHint}>
                           Esto puede tardar 1-2 minutos con muchas prendas…
                        </Text>
                     )}
                  </View>
               )}

               <ScrollView style={styles.body}>
                  <View style={styles.summaryBanner}>
                     <CheckCircle2 size={18} color="#2563eb" style={{ marginRight: 8 }} />
                     <Text style={styles.summaryText}>
                        Se incluirán <Text style={{ fontWeight: 'bold' }}>{products.length}</Text> prendas
                        {activeCategoryName && activeCategoryName !== 'all'
                           ? ` de la categoría "${activeCategoryName}"`
                           : ' del filtro actual'}.
                     </Text>
                  </View>

                  {/* Advertencia si hay muchas prendas */}
                  {showLongWarning && !isGenerating && (
                     <View style={styles.warningBanner}>
                        <Clock size={16} color="#d97706" style={{ marginRight: 8 }} />
                        <Text style={styles.warningText}>
                           Con {products.length} prendas puede tardar 1-2 minutos.
                           Usa una conexión Wi-Fi para mayor velocidad.
                        </Text>
                     </View>
                  )}

                  {isExpoGo && !isGenerating && (
                     <View style={styles.infoBanner}>
                        <Text style={styles.infoText}>
                           💡 En Expo Go se abrirá el diálogo de impresión del sistema.
                           Elige "Guardar como PDF" para exportarlo. En la versión compilada
                           podrás compartirlo directo a WhatsApp / Drive / etc.
                        </Text>
                     </View>
                  )}

                  {errorMsg && (
                     <View style={styles.errorBanner}>
                        <AlertCircle size={18} color="#dc2626" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                           <Text style={styles.errorTitle}>No se pudo generar el catálogo</Text>
                           <Text style={styles.errorText}>{errorMsg}</Text>
                        </View>
                     </View>
                  )}

                  <View style={[styles.optionRow, isGenerating && styles.disabled]}>
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
                        disabled={isGenerating}
                     />
                  </View>

                  <Text style={styles.label}>Nombre de la Tienda / Marca en el documento:</Text>
                  <TextInput
                     style={[styles.input, isGenerating && styles.disabled]}
                     value={storeName}
                     onChangeText={setStoreName}
                     placeholder="Ej: Boutique Elegance"
                     placeholderTextColor="#94a3b8"
                     editable={!isGenerating}
                  />

                  <Text style={styles.label}>Nota o mensaje al pie de cabecera (Opcional):</Text>
                  <TextInput
                     style={[styles.input, isGenerating && styles.disabled]}
                     value={customSubtitle}
                     onChangeText={setCustomSubtitle}
                     placeholder="Ej: Colección Temporada Invierno / Promoción"
                     placeholderTextColor="#94a3b8"
                     editable={!isGenerating}
                  />
               </ScrollView>

               <View style={styles.footer}>
                  <TouchableOpacity
                     style={[styles.cancelBtn, isGenerating && { opacity: 0.5 }]}
                     onPress={onClose}
                     disabled={isGenerating}
                  >
                     <Text style={styles.cancelBtnText}>Cerrar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={[styles.printBtn, isGenerating && { opacity: 0.7 }]}
                     onPress={handleTriggerPrint}
                     disabled={isGenerating}
                  >
                     {isGenerating ? (
                        <>
                           <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                           <Text style={styles.printBtnText}>Generando…</Text>
                        </>
                     ) : (
                        <>
                           <Zap size={16} color="#ffffff" style={{ marginRight: 6 }} />
                           <Text style={styles.printBtnText}>Generar Vista / PDF</Text>
                        </>
                     )}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 440, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', maxHeight: '90%' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
   title: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
   body: { padding: 16 },
   summaryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 16 },
   summaryText: { fontSize: 12, color: '#1e40af', flex: 1 },
   warningBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 10, marginBottom: 16 },
   warningText: { fontSize: 11, color: '#78350f', flex: 1, lineHeight: 16 },
   errorBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 10, marginBottom: 16 },
   errorTitle: { fontSize: 12, fontWeight: 'bold', color: '#dc2626', marginBottom: 2 },
   errorText: { fontSize: 11, color: '#7f1d1d', lineHeight: 15 },

   // Progreso
   progressCard: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 10, padding: 12, marginBottom: 16 },
   progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
   progressLabel: { fontSize: 12, fontWeight: '600', color: '#0c4a6e', flexShrink: 1 },
   progressTimer: { fontSize: 11, color: '#0369a1', fontWeight: 'bold', marginLeft: 8 },
   progressBar: { height: 8, backgroundColor: '#e0f2fe', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
   progressFill: { height: '100%', backgroundColor: '#0284c7', borderRadius: 4 },
   progressCounter: { fontSize: 10, color: '#0369a1', textAlign: 'center', marginBottom: 8 },
   cancelProgressText: { fontSize: 11, fontWeight: 'bold', color: '#dc2626' },

   progressCardFloating: {
      backgroundColor: '#f0f9ff',
      borderBottomWidth: 1,
      borderBottomColor: '#bae6fd',
      paddingHorizontal: 16,
      paddingVertical: 12,
   },
   progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
   },
   progressHint: {
      fontSize: 11,
      color: '#0369a1',
      fontStyle: 'italic',
      marginTop: 6,
      textAlign: 'center',
   },
   cancelProgressBtn: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: '#fee2e2',
   },

   optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 16 },
   optionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
   optionDescription: { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 16 },
   label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
   input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 13, color: '#0f172a', marginBottom: 12 },
   disabled: { opacity: 0.55 },

   footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
   cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
   cancelBtnText: { color: '#475569', fontSize: 13, fontWeight: 'bold' },
   printBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
   printBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

   infoBanner: {
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#fcd34d',
      borderRadius: 8,
      padding: 10,
      marginBottom: 16,
   },
   infoText: {
      fontSize: 11,
      color: '#78350f',
      lineHeight: 16,
   },
});
