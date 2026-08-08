import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants';
import { useAuth } from '../../context/AuthContext';

// Placeholder — full implementation in Phase 4
export default function OwnerDashboardScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Owner Dashboard</Text>
          <Text style={styles.headerSub}>Adarsh Infra</Text>
        </View>
        <TouchableOpacity onPress={logout} accessibilityLabel="Logout">
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.placeholder}>Owner Dashboard — Phase 4</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  headerSub: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },
  logoutText: { color: Colors.accent, fontWeight: FontWeight.semiBold, fontSize: FontSize.sm },
  scroll: { flex: 1 },
  content: { padding: Spacing.base, alignItems: 'center', paddingTop: Spacing.xxxl },
  placeholder: { fontSize: FontSize.base, color: Colors.textMuted },
});
