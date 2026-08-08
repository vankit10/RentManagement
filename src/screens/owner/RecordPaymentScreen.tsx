import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OwnerStackParamList } from '../../types';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants';

type Props = NativeStackScreenProps<OwnerStackParamList, 'RecordPayment'>;

// Placeholder — full implementation in Phase 5
export default function RecordPaymentScreen({ route }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Record Payment</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.placeholder}>Tenant ID: {route.params.tenantId}</Text>
        <Text style={styles.placeholder}>Record Payment Form — Phase 5</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.base, paddingVertical: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  placeholder: { fontSize: FontSize.base, color: Colors.textMuted },
});
