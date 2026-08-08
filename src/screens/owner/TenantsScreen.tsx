import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants';

// Placeholder — full implementation in Phase 4
export default function OwnerTenantsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tenants</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.placeholder}>Tenants List — Phase 4</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.base, paddingVertical: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontSize: FontSize.base, color: Colors.textMuted },
});
