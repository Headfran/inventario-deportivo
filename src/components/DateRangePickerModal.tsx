import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView } from 'react-native';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react-native';

interface DateRangePickerModalProps {
   visible: boolean;
   onClose: () => void;
   onApply: (range: { start: Date; end: Date }) => void;
   initialRange?: { start: Date; end: Date } | null;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const daysOfWeek = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const START_YEAR = 2020; // Año base para el selector de años
const YEARS_TO_SHOW = 20; // Cuántos años mostrar en la lista

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({ visible, onClose, onApply, initialRange }) => {
   const [activeDateType, setActiveDateType] = useState<'start' | 'end'>('start');
   const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
   const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

   // Navegación del calendario
   const [calendarMonth, setCalendarMonth] = useState(new Date());
   const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');

   // Reiniciar estados cuando se abre el modal
   useEffect(() => {
      if (visible) {
         setTempStartDate(initialRange?.start || null);
         setTempEndDate(initialRange?.end || null);
         setActiveDateType('start');
         setCalendarMonth(initialRange?.start || new Date());
         setViewMode('days');
      }
   }, [visible, initialRange]);

   const handleApply = () => {
      if (!tempStartDate || !tempEndDate) {
         Alert.alert('Faltan datos', 'Debes seleccionar una fecha de inicio y una de fin.');
         return;
      }
      // Aseguramos que el final del día cubra hasta las 23:59:59
      const end = new Date(tempEndDate);
      end.setHours(23, 59, 59, 999);

      onApply({ start: tempStartDate, end });
   };

   const handleDayPress = (date: Date) => {
      if (activeDateType === 'start') {
         setTempStartDate(date);
         if (tempEndDate && date > tempEndDate) setTempEndDate(null);
         setActiveDateType('end'); // Salto automático
      } else {
         if (tempStartDate && date < tempStartDate) {
            setTempStartDate(date);
            setTempEndDate(null);
         } else {
            setTempEndDate(date);
         }
      }
   };

   const renderDaysView = () => {
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

      return (
         <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
               <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))} style={{ padding: 4 }}>
                  <ChevronLeft size={20} color="#0f172a" />
               </TouchableOpacity>

               {/* Selectores Rápidos de Mes y Año */}
               <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setViewMode('months')} style={styles.quickSelectBtn}>
                     <Text style={styles.calendarMonthText}>{monthNames[month]}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode('years')} style={styles.quickSelectBtn}>
                     <Text style={styles.calendarMonthText}>{year}</Text>
                  </TouchableOpacity>
               </View>

               <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))} style={{ padding: 4 }}>
                  <ChevronRight size={20} color="#0f172a" />
               </TouchableOpacity>
            </View>

            <View style={styles.calendarDaysHeader}>
               {daysOfWeek.map(d => <Text key={d} style={styles.calendarDayLabel}>{d}</Text>)}
            </View>

            <View style={styles.calendarGrid}>
               {days.map((date, idx) => {
                  if (!date) return <View key={idx} style={styles.calendarCellEmpty} />;

                  const dString = date.toDateString();
                  const isStart = tempStartDate && dString === tempStartDate.toDateString();
                  const isEnd = tempEndDate && dString === tempEndDate.toDateString();
                  const isBetween = tempStartDate && tempEndDate && date > tempStartDate && date < tempEndDate;

                  let bg = 'transparent';
                  let textColor = '#334155';
                  if (isStart || isEnd) { bg = '#2563eb'; textColor = '#ffffff'; }
                  else if (isBetween) { bg = '#eff6ff'; textColor = '#1d4ed8'; }

                  return (
                     <TouchableOpacity
                        key={idx}
                        style={[styles.calendarCell, { backgroundColor: bg }]}
                        onPress={() => handleDayPress(date)}
                     >
                        <Text style={[styles.calendarCellText, { color: textColor }]}>{date.getDate()}</Text>
                     </TouchableOpacity>
                  );
               })}
            </View>
         </View>
      );
   };

   const renderMonthsView = () => (
      <View style={styles.calendarContainer}>
         <Text style={styles.viewModeTitle}>Selecciona un Mes</Text>
         <View style={styles.gridContainer}>
            {monthNamesShort.map((m, idx) => (
               <TouchableOpacity
                  key={m}
                  style={[styles.gridItem, calendarMonth.getMonth() === idx && styles.gridItemActive]}
                  onPress={() => {
                     setCalendarMonth(new Date(calendarMonth.getFullYear(), idx, 1));
                     setViewMode('days');
                  }}
               >
                  <Text style={[styles.gridItemText, calendarMonth.getMonth() === idx && styles.gridItemTextActive]}>{m}</Text>
               </TouchableOpacity>
            ))}
         </View>
      </View>
   );

   const renderYearsView = () => {
      const years = Array.from({ length: YEARS_TO_SHOW }, (_, i) => START_YEAR + i);
      return (
         <View style={styles.calendarContainer}>
            <Text style={styles.viewModeTitle}>Selecciona un Año</Text>
            <ScrollView style={{ maxHeight: 250 }}>
               <View style={styles.gridContainer}>
                  {years.map((y) => (
                     <TouchableOpacity
                        key={y}
                        style={[styles.gridItem, calendarMonth.getFullYear() === y && styles.gridItemActive]}
                        onPress={() => {
                           setCalendarMonth(new Date(y, calendarMonth.getMonth(), 1));
                           setViewMode('months'); // Flujo lógico: del año pasas a elegir el mes
                        }}
                     >
                        <Text style={[styles.gridItemText, calendarMonth.getFullYear() === y && styles.gridItemTextActive]}>{y}</Text>
                     </TouchableOpacity>
                  ))}
               </View>
            </ScrollView>
         </View>
      );
   };

   return (
      <Modal visible={visible} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.calendarModalCard}>
               <View style={styles.modalHeader}>
                  <CalendarRange size={22} color="#2563eb" style={{ marginRight: 8 }} />
                  <Text style={styles.modalTitle}>Fechas Personalizadas</Text>
               </View>

               {/* Pestañas Desde / Hasta */}
               <View style={styles.datePickerTabs}>
                  <TouchableOpacity
                     style={[styles.datePickerTab, activeDateType === 'start' && styles.datePickerTabActive]}
                     onPress={() => setActiveDateType('start')}
                  >
                     <Text style={[styles.datePickerLabel, activeDateType === 'start' && { color: '#2563eb' }]}>Desde</Text>
                     <Text style={[styles.datePickerValue, activeDateType === 'start' && { color: '#2563eb' }]}>{formatDateShort(tempStartDate)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={[styles.datePickerTab, activeDateType === 'end' && styles.datePickerTabActive]}
                     onPress={() => setActiveDateType('end')}
                  >
                     <Text style={[styles.datePickerLabel, activeDateType === 'end' && { color: '#2563eb' }]}>Hasta</Text>
                     <Text style={[styles.datePickerValue, activeDateType === 'end' && { color: '#2563eb' }]}>{formatDateShort(tempEndDate)}</Text>
                  </TouchableOpacity>
               </View>

               {/* Renderizado Dinámico */}
               {viewMode === 'days' && renderDaysView()}
               {viewMode === 'months' && renderMonthsView()}
               {viewMode === 'years' && renderYearsView()}

               <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                     <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                     <Text style={styles.applyText}>Aplicar Rango</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
   calendarModalCard: { width: '100%', maxWidth: 380, backgroundColor: '#ffffff', borderRadius: 20, padding: 20 },
   modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
   modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },

   datePickerTabs: { flexDirection: 'row', gap: 10, marginBottom: 16 },
   datePickerTab: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center' },
   datePickerTabActive: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
   datePickerLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
   datePickerValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },

   calendarContainer: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, backgroundColor: '#ffffff' },
   calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
   quickSelectBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9' },
   calendarMonthText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', textTransform: 'capitalize' },
   calendarDaysHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
   calendarDayLabel: { fontSize: 11, color: '#64748b', width: '14.28%', textAlign: 'center', fontWeight: 'bold' },
   calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
   calendarCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginVertical: 2 },
   calendarCellEmpty: { width: '14.28%', aspectRatio: 1 },
   calendarCellText: { fontSize: 13, fontWeight: '600' },

   viewModeTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569', textAlign: 'center', marginBottom: 12 },
   gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
   gridItem: { width: '30%', paddingVertical: 12, marginBottom: 10, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
   gridItemActive: { backgroundColor: '#2563eb' },
   gridItemText: { fontSize: 14, fontWeight: '600', color: '#334155' },
   gridItemTextActive: { color: '#ffffff' },

   modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
   cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
   cancelText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
   applyBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
   applyText: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },
});
