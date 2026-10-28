import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { showAlert } from '../utils/alert';
import { MONO as T, display } from '../design';

interface DateRangePickerModalProps {
   visible: boolean;
   onClose: () => void;
   onApply: (range: { start: Date; end: Date }) => void;
   initialRange?: { start: Date; end: Date } | null;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const daysOfWeek = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const START_YEAR = 2020;
const YEARS_TO_SHOW = 20;

const formatDateShort = (date: Date | null) => {
   if (!date) return '--/--/----';
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

const isSameDay = (a: Date, b: Date) =>
   a.getFullYear() === b.getFullYear() &&
   a.getMonth() === b.getMonth() &&
   a.getDate() === b.getDate();

const P = ({ style, ...rest }: any) => (
   <Pressable {...rest} style={({ pressed }: any) => [style, pressed && styles.pressed]} />
);

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
   visible,
   onClose,
   onApply,
   initialRange,
}) => {
   const [activeDateType, setActiveDateType] = useState<'start' | 'end'>('start');
   const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
   const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

   const [calendarMonth, setCalendarMonth] = useState(new Date());
   const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');

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
         showAlert('Faltan datos', 'Debes seleccionar una fecha de inicio y una de fin.');
         return;
      }
      const end = new Date(tempEndDate);
      end.setHours(23, 59, 59, 999);
      onApply({ start: tempStartDate, end });
   };

   const handleDayPress = (date: Date) => {
      if (activeDateType === 'start') {
         setTempStartDate(date);
         if (tempEndDate && date > tempEndDate) setTempEndDate(null);
         setActiveDateType('end');
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
      const today = new Date();

      const days: (Date | null)[] = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

      return (
         <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
               <P style={styles.navBtn} onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}>
                  <ChevronLeft size={18} color={T.ink} />
               </P>

               <View style={{ flexDirection: 'row', gap: 6 }}>
                  <P style={styles.quickSelectBtn} onPress={() => setViewMode('months')}>
                     <Text style={styles.quickSelectText}>{monthNames[month]}</Text>
                  </P>
                  <P style={styles.quickSelectBtn} onPress={() => setViewMode('years')}>
                     <Text style={styles.quickSelectText}>{year}</Text>
                  </P>
               </View>

               <P style={styles.navBtn} onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}>
                  <ChevronRight size={18} color={T.ink} />
               </P>
            </View>

            <View style={styles.calendarDaysHeader}>
               {daysOfWeek.map((d) => (
                  <Text key={d} style={styles.calendarDayLabel}>{d}</Text>
               ))}
            </View>

            <View style={styles.calendarGrid}>
               {days.map((date, idx) => {
                  if (!date) return <View key={idx} style={styles.calendarCellEmpty} />;

                  const isStart = tempStartDate && isSameDay(date, tempStartDate);
                  const isEnd = tempEndDate && isSameDay(date, tempEndDate);
                  const isBetween =
                     tempStartDate && tempEndDate && date > tempStartDate && date < tempEndDate;
                  const isToday = isSameDay(date, today);

                  return (
                     <P
                        key={idx}
                        style={[
                           styles.calendarCell,
                           isBetween && styles.calendarCellBetween,
                           (isStart || isEnd) && styles.calendarCellEdge,
                           isToday && !isStart && !isEnd && styles.calendarCellToday,
                        ]}
                        onPress={() => handleDayPress(date)}
                     >
                        <Text
                           style={[
                              styles.calendarCellText,
                              isBetween && { color: T.ink },
                              (isStart || isEnd) && { color: T.onSolid },
                           ]}
                        >
                           {date.getDate()}
                        </Text>
                     </P>
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
               <P
                  key={m}
                  style={[styles.gridItem, calendarMonth.getMonth() === idx && styles.gridItemActive]}
                  onPress={() => {
                     setCalendarMonth(new Date(calendarMonth.getFullYear(), idx, 1));
                     setViewMode('days');
                  }}
               >
                  <Text
                     style={[
                        styles.gridItemText,
                        calendarMonth.getMonth() === idx && styles.gridItemTextActive,
                     ]}
                  >
                     {m}
                  </Text>
               </P>
            ))}
         </View>
      </View>
   );

   const renderYearsView = () => {
      const years = Array.from({ length: YEARS_TO_SHOW }, (_, i) => START_YEAR + i);
      return (
         <View style={styles.calendarContainer}>
            <Text style={styles.viewModeTitle}>Selecciona un Año</Text>
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
               <View style={styles.gridContainer}>
                  {years.map((y) => (
                     <P
                        key={y}
                        style={[styles.gridItem, calendarMonth.getFullYear() === y && styles.gridItemActive]}
                        onPress={() => {
                           setCalendarMonth(new Date(y, calendarMonth.getMonth(), 1));
                           setViewMode('days');
                        }}
                     >
                        <Text
                           style={[
                              styles.gridItemText,
                              calendarMonth.getFullYear() === y && styles.gridItemTextActive,
                           ]}
                        >
                           {y}
                        </Text>
                     </P>
                  ))}
               </View>
            </ScrollView>
         </View>
      );
   };

   return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
         <View style={styles.overlay}>
            <View style={styles.card}>
               {/* Header banner */}
               <View style={styles.header}>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.title}>Fechas Personalizadas</Text>
                     <Text style={styles.subtitle}>Selecciona el rango de fechas</Text>
                  </View>
                  <P style={styles.closeBtn} onPress={onClose}>
                     <X size={18} color={T.onBar} />
                  </P>
               </View>

               <View style={styles.body}>
                  {/* Tabs Desde / Hasta */}
                  <View style={styles.datePickerTabs}>
                     <P
                        style={[styles.datePickerTab, activeDateType === 'start' && styles.datePickerTabActive]}
                        onPress={() => setActiveDateType('start')}
                     >
                        <Text style={[styles.datePickerLabel, activeDateType === 'start' && { color: T.ink }]}>
                           Desde
                        </Text>
                        <Text style={[styles.datePickerValue, activeDateType === 'start' && { color: T.ink }]}>
                           {formatDateShort(tempStartDate)}
                        </Text>
                     </P>

                     <P
                        style={[styles.datePickerTab, activeDateType === 'end' && styles.datePickerTabActive]}
                        onPress={() => setActiveDateType('end')}
                     >
                        <Text style={[styles.datePickerLabel, activeDateType === 'end' && { color: T.ink }]}>
                           Hasta
                        </Text>
                        <Text style={[styles.datePickerValue, activeDateType === 'end' && { color: T.ink }]}>
                           {formatDateShort(tempEndDate)}
                        </Text>
                     </P>
                  </View>

                  {viewMode === 'days' && renderDaysView()}
                  {viewMode === 'months' && renderMonthsView()}
                  {viewMode === 'years' && renderYearsView()}
               </View>

               {/* Footer */}
               <View style={styles.footer}>
                  <P style={styles.cancelBtn} onPress={onClose}>
                     <Text style={styles.cancelText}>Cancelar</Text>
                  </P>
                  <P style={styles.applyBtn} onPress={handleApply}>
                     <CalendarRange size={16} color={T.onSolid} />
                     <Text style={styles.applyText}>Aplicar Rango</Text>
                  </P>
               </View>
            </View>
         </View>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
   card: { width: '100%', maxWidth: 400, backgroundColor: T.bg, borderRadius: 16, overflow: 'hidden' },
   pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      padding: 20,
      backgroundColor: T.bar,
   },
   title: {
      ...display,
      fontSize: 28,
      lineHeight: 28,
      fontWeight: '800',
      color: T.onBar,
      textTransform: 'uppercase',
   },
   subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
   closeBtn: { padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 10 },

   body: { padding: 16, gap: 12 },

   datePickerTabs: { flexDirection: 'row', gap: 8 },
   datePickerTab: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: T.line,
      backgroundColor: T.surface,
      alignItems: 'center',
   },
   datePickerTabActive: { borderColor: T.ink, backgroundColor: T.bg },
   datePickerLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: T.inkMute,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   datePickerValue: { ...display, fontSize: 16, fontWeight: '800', color: T.inkSoft },

   calendarContainer: { backgroundColor: T.surface, borderRadius: 12, padding: 12 },
   calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
   },
   navBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: T.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: T.bg,
   },
   quickSelectBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: T.bg,
      borderWidth: 1,
      borderColor: T.line,
   },
   quickSelectText: {
      fontSize: 13,
      fontWeight: '800',
      color: T.ink,
      textTransform: 'capitalize',
   },

   calendarDaysHeader: { flexDirection: 'row', marginBottom: 6 },
   calendarDayLabel: {
      flex: 1,
      fontSize: 11,
      color: T.inkMute,
      textAlign: 'center',
      fontWeight: '800',
      textTransform: 'uppercase',
   },
   calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
   calendarCell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
   },
   calendarCellEmpty: { width: '14.28%', aspectRatio: 1 },
   calendarCellBetween: { backgroundColor: T.surface, borderRadius: 0 },
   calendarCellEdge: { backgroundColor: T.solid, borderRadius: 20 },
   calendarCellToday: { borderWidth: 1.5, borderColor: T.ink, borderRadius: 20 },
   calendarCellText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },

   viewModeTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: T.inkSoft,
      textAlign: 'center',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
   },
   gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
   gridItem: {
      width: '31%',
      paddingVertical: 14,
      marginBottom: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: T.line,
      backgroundColor: T.bg,
      alignItems: 'center',
   },
   gridItemActive: { backgroundColor: T.solid, borderColor: T.solid },
   gridItemText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
   gridItemTextActive: { color: T.onSolid, fontWeight: '800' },

   footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 16,
   },
   cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.line,
      alignItems: 'center',
      justifyContent: 'center',
   },
   cancelText: { fontSize: 13, fontWeight: '700', color: T.ink },
   applyBtn: {
      flex: 2,
      height: 44,
      borderRadius: 10,
      backgroundColor: T.solid,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
   },
   applyText: { fontSize: 13, fontWeight: '800', color: T.onSolid },
});
