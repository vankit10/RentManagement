import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../constants';

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date();

export default function DatePickerInput({ label, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => fromIso(value));
  const selected = fromIso(value);
  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = first.getDay();
    const count = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    return Array.from({ length: start + count }, (_, index) => index < start ? null : index - start + 1);
  }, [visibleMonth]);

  const choose = (day: number) => {
    onChange(toIso(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)));
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={[styles.input, !!error && styles.inputError]} onPress={() => { setVisibleMonth(selected); setOpen(true); }} accessibilityLabel={`Choose ${label}`}>
        <Text style={styles.value}>{value || 'Select date'}</Text><Icon name="calendar-month-outline" size={20} color={Colors.primary} />
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><Icon name="chevron-left" size={26} color={Colors.primary} /></TouchableOpacity>
              <Text style={styles.monthTitle}>{visibleMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><Icon name="chevron-right" size={26} color={Colors.primary} /></TouchableOpacity>
            </View>
            <View style={styles.week}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
            <View style={styles.grid}>{days.map((day, index) => day === null ? <View key={`blank-${index}`} style={styles.day} /> : <TouchableOpacity key={day} style={[styles.day, selected.getFullYear() === visibleMonth.getFullYear() && selected.getMonth() === visibleMonth.getMonth() && selected.getDate() === day && styles.selectedDay]} onPress={() => choose(day)}><Text style={[styles.dayText, selected.getFullYear() === visibleMonth.getFullYear() && selected.getMonth() === visibleMonth.getMonth() && selected.getDate() === day && styles.selectedText]}>{day}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.base }, label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md }, inputError: { borderColor: Colors.error }, value: { fontSize: FontSize.base, color: Colors.textPrimary }, error: { color: Colors.error, fontSize: FontSize.xs, marginTop: Spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }, modal: { width: '100%', maxWidth: 380, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }, monthTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary }, week: { flexDirection: 'row' }, weekDay: { width: `${100 / 7}%`, textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.xs, paddingBottom: Spacing.xs }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full }, dayText: { color: Colors.textPrimary, fontSize: FontSize.sm }, selectedDay: { backgroundColor: Colors.primary }, selectedText: { color: Colors.textInverse, fontWeight: FontWeight.bold }, cancel: { alignSelf: 'flex-end', marginTop: Spacing.sm, padding: Spacing.sm }, cancelText: { color: Colors.primary, fontWeight: FontWeight.semiBold },
});
