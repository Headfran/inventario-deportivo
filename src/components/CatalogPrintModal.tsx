import React, { useState, useEffect, useRef } from 'react';
import {
   View, Text, Modal, StyleSheet, TouchableOpacity, Switch,
   TextInput, ScrollView, ActivityIndicator, Platform, Animated,
} from 'react-native';
import { Printer, X, FileText, DollarSign, CheckCircle2, AlertCircle, Clock } from 'lucide-react-native';
import { Product } from '../types/inventory';
import { generateCatalogPrint, CatalogPrintProgress } from '../utils/printCatalog';
import { C, caps, box, label, btn, btnText, overlay, modalCard } from '../theme';
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
   const [showPrices, setShowPrices] = useState(false);
   const [storeName, setStoreName] = useState('JD Store');
   const [customSubtitle, setCustomSubtitle] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [progress, setProgress] = useState<CatalogPrintProgress | null>(null);
   const [elapsed, setElapsed] = useState(0);
   const cancelRef = useRef(false);

   // Animación de barra indeterminada (para cuando el util no reporta done/total)
   const shimmerAnim = useRef(new Animated.Value(0)).current;

   const isExpoGo = Platform.OS !== 'web' && (
      Constants?.executionEnvironment === 'storeClient' ||
      String((Constants as any)?.executionEnvironment || '').toLowerCase().includes('storeclient')
   );

   const hasGranularProgress = !!(progress && progress.total > 0);

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

   // Animación del shimmer: solo cuando estamos generando y NO hay progreso granular
   useEffect(() => {
      if (isGenerating && !hasGranularProgress) {
         shimmerAnim.setValue(0);
         const loop = Animated.loop(
            Animated.timing(shimmerAnim, {
               toValue: 1,
               duration: 1400,
               useNativeDriver: true,
            })
         );
         loop.start();
         return () => loop.stop();
      } else {
         shimmerAnim.setValue(0);
      }
   }, [isGenerating, hasGranularProgress]);

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
      setProgress((prev) => prev ? { ...prev, message: 'Cancelando…' } : prev);
   };

   const percent = hasGranularProgress
      ? Math.min(100, Math.round((progress!.done / progress!.total) * 100))
      : 0;

   const showLongWarning = products.length > 30;

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={styles.card}>
               <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                     <Printer size={20} color={C.light} />
                     <Text style={styles.title}>Exportar / Imprimir Catálogo</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} disabled={isGenerating}>
                     <X size={20} color={isGenerating ? C.dim : C.soft} />
                  </TouchableOpacity>
               </View>

               {/* PROGRESO */}
               {isGenerating && (
                  <View style={styles.progressCardFloating}>
                     {/* Encabezado: mensaje + timer grande */}
                     <View style={styles.progressHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                           <ActivityIndicator size="small" color={C.light} />
                           <Text style={styles.progressLabel} numberOfLines={1}>
                              {progress?.message || 'Procesando…'}
                           </Text>
                        </View>
                        <View style={styles.timerBox}>
                           <Clock size={11} color={C.mute} />
                           <Text style={styles.progressTimer}>{formatElapsed(elapsed)}</Text>
                        </View>
                     </View>

                     {/* Barra: determinate si hay datos, indeterminada si no */}
                     <View style={styles.progressBar}>
                        {hasGranularProgress ? (
                           <View style={[styles.progressFill, { width: `${percent}%` }]} />
                        ) : (
                           <Animated.View
                              style={[
                                 styles.progressFillIndeterminate,
                                 {
                                    transform: [{
                                       translateX: shimmerAnim.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: [-120, 400],
                                       }),
                                    }],
                                 },
                              ]}
                           />
                        )}
                     </View>

                     {/* Footer: contador real o aviso de "trabajando" */}
                     {hasGranularProgress ? (
                        <View style={styles.progressFooter}>
                           <Text style={styles.progressCounter}>
                              {progress!.done} / {progress!.total} imágenes ({percent}%)
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
                     ) : (
                        <View style={styles.progressFooter}>
                           <Text style={styles.progressCounter} numberOfLines={1}>
                              Trabajando en {products.length} prendas…
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
                     )}
                  </View>
               )}

               <ScrollView style={{ padding: 16 }}>
                  <View style={styles.summaryBanner}>
                     <CheckCircle2 size={18} color={C.light} style={{ marginRight: 8 }} />
                     <Text style={styles.summaryText}>
                        Se incluirán <Text style={{ fontWeight: 'bold', color: C.white }}>{products.length}</Text> prendas
                        {activeCategoryName && activeCategoryName !== 'all'
                           ? ` de la categoría "${activeCategoryName}"`
                           : ' del filtro actual'}.
                     </Text>
                  </View>

                  {showLongWarning && !isGenerating && (
                     <View style={styles.warningBanner}>
                        <Clock size={16} color={C.light} style={{ marginRight: 8 }} />
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
                        <AlertCircle size={18} color={C.white} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                           <Text style={styles.errorTitle}>No se pudo generar el catálogo</Text>
                           <Text style={styles.errorText}>{errorMsg}</Text>
                        </View>
                     </View>
                  )}

                  <View style={[styles.optionRow, isGenerating && styles.disabled]}>
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
                        disabled={isGenerating}
                     />
                  </View>

                  <Text style={styles.label}>Nombre de la Tienda / Marca en el documento:</Text>
                  <TextInput
                     style={[styles.input, isGenerating && styles.disabled]}
                     value={storeName}
                     onChangeText={setStoreName}
                     placeholder="Ej: Boutique Elegance"
                     placeholderTextColor={C.dim}
                     editable={!isGenerating}
                  />

                  <Text style={styles.label}>Nota o mensaje al pie de cabecera (Opcional):</Text>
                  <TextInput
                     style={[styles.input, isGenerating && styles.disabled]}
                     value={customSubtitle}
                     onChangeText={setCustomSubtitle}
                     placeholder="Ej: Colección Temporada Invierno / Promoción"
                     placeholderTextColor={C.dim}
                     editable={!isGenerating}
                  />
               </ScrollView>

               <View style={styles.footer}>
                  <TouchableOpacity
                     style={[styles.cancelBtn, isGenerating && { opacity: 0.5 }]}
                     onPress={onClose}
                     disabled={isGenerating}
                  >
                     <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={[styles.printBtn, isGenerating && { opacity: 0.7 }]}
                     onPress={handleTriggerPrint}
                     disabled={isGenerating}
                  >
                     {isGenerating ? (
                        <>
                           <ActivityIndicator size="small" color={C.bg} style={{ marginRight: 8 }} />
                           <Text style={styles.printText}>Generando…</Text>
                        </>
                     ) : (
                        <>
                           <FileText size={16} color={C.bg} style={{ marginRight: 6 }} />
                           <Text style={styles.printText}>Generar Vista / PDF</Text>
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
   overlay,
   card: { ...modalCard, maxHeight: '90%' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: C.border },
   title: { ...caps, fontSize: 13, fontWeight: '900', color: C.white },

   // Banners
   summaryBanner: { ...box, flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 16 },
   summaryText: { fontSize: 12, color: C.soft, flex: 1 },
   warningBanner: { ...box, flexDirection: 'row', alignItems: 'flex-start', padding: 10, marginBottom: 16, borderColor: C.light },
   warningText: { fontSize: 11, color: C.soft, flex: 1, lineHeight: 16 },
   infoBanner: { ...box, padding: 10, marginBottom: 16 },
   infoText: { fontSize: 11, color: C.mute, lineHeight: 16 },
   errorBanner: { ...box, flexDirection: 'row', alignItems: 'flex-start', padding: 10, marginBottom: 16, borderColor: C.light },
   errorTitle: { fontSize: 12, fontWeight: 'bold', color: C.white, marginBottom: 2 },
   errorText: { fontSize: 11, color: C.soft, lineHeight: 15 },

   // Progreso
   progressCardFloating: { backgroundColor: C.raised, borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 16, paddingVertical: 12 },
   progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
   progressLabel: { fontSize: 12, fontWeight: '600', color: C.soft, flexShrink: 1 },
   timerBox: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: C.line, borderRadius: 2 },
   progressTimer: { fontSize: 11, color: C.light, fontWeight: 'bold' },
   progressBar: { height: 6, backgroundColor: C.line, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
   progressFill: { height: '100%', backgroundColor: C.light, borderRadius: 2 },
   progressFillIndeterminate: { width: 120, height: '100%', backgroundColor: C.light, opacity: 0.85, borderRadius: 2 },
   progressFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
   progressCounter: { fontSize: 11, color: C.mute, flex: 1, marginRight: 8 },
   cancelProgressBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 2, borderWidth: 1, borderColor: C.light },
   cancelProgressText: { fontSize: 11, fontWeight: 'bold', color: C.white },

   // Opciones
   optionRow: { ...box, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, marginBottom: 16 },
   optionTitle: { fontSize: 13, fontWeight: 'bold', color: C.white },
   optionDescription: { fontSize: 11, color: C.mute, marginTop: 2, lineHeight: 16 },
   label,
   input: { ...box, paddingHorizontal: 12, height: 40, fontSize: 13, color: C.white, marginBottom: 12 },
   disabled: { opacity: 0.55 },

   // Footer
   footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16, backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: C.border },
   cancelBtn: { ...btn, paddingHorizontal: 16, borderWidth: 1, borderColor: '#3A3A3A' },
   cancelText: { ...btnText, color: C.soft },
   printBtn: { ...btn, paddingHorizontal: 16, backgroundColor: C.light },
   printText: { ...btnText, color: C.bg },
});
