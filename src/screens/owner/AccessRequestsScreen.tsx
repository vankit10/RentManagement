import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import { getAccessRequests, updateAccessRequest } from '../../services/tenantService';
import type { AccessRequest, OwnerStackParamList } from '../../types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'AccessRequests'>;

export default function AccessRequestsScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await getAccessRequests());
    } catch {
      Alert.alert('Could not load requests', 'Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const reject = (request: AccessRequest) => {
    Alert.alert('Reject request?', `Reject ${request.tenant.name}'s request?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive', onPress: async () => {
          setUpdatingId(request.id);
          try {
            await updateAccessRequest(request.id, 'REJECTED');
            setRequests(current => current.filter(item => item.id !== request.id));
          } catch {
            Alert.alert('Could not reject request', 'Please try again.');
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  };

  const accept = async (request: AccessRequest) => {
    setUpdatingId(request.id);
    try {
      await updateAccessRequest(request.id, 'ACCEPTED');
      setRequests(current => current.filter(item => item.id !== request.id));
      navigation.navigate('AddEditTenant', { tenantId: request.tenant.id });
    } catch {
      Alert.alert('Could not accept request', 'Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Icon name="arrow-left" size={24} color={Colors.textInverse} /></TouchableOpacity>
        <Text style={styles.title}>Access Requests</Text>
        <View style={styles.headerSpacer} />
      </View>
      {isLoading ? <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} /> : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          contentContainerStyle={requests.length ? styles.list : styles.empty}
          refreshing={isLoading}
          onRefresh={() => { setIsLoading(true); loadRequests(); }}
          ListEmptyComponent={<View style={styles.emptyContent}><Icon name="email-check-outline" size={52} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No pending requests</Text><Text style={styles.emptyText}>Requests from tenants will appear here.</Text></View>}
          renderItem={({ item }) => {
            const isUpdating = updatingId === item.id;
            return <View style={styles.card}>
              <View style={styles.person}><View style={styles.avatar}><Icon name="account" size={22} color={Colors.primary} /></View><View style={styles.personText}><Text style={styles.name}>{item.tenant.name}</Text><Text style={styles.detail}>{item.tenant.email || item.tenant.phone}</Text></View></View>
              <Text style={styles.help}>Accept to complete their tenant details, including room and rent.</Text>
              <View style={styles.actions}><TouchableOpacity disabled={isUpdating} style={styles.reject} onPress={() => reject(item)}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity><TouchableOpacity disabled={isUpdating} style={styles.accept} onPress={() => accept(item)}>{isUpdating ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.acceptText}>Accept & set up</Text>}</TouchableOpacity></View>
            </View>;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background }, header: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.base }, title: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: FontWeight.semiBold }, headerSpacer: { width: 24 }, loader: { flex: 1 }, list: { padding: Spacing.base }, empty: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl }, emptyContent: { alignItems: 'center' }, emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semiBold, marginTop: Spacing.md }, emptyText: { color: Colors.textMuted, fontSize: FontSize.base, marginTop: Spacing.xs }, card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.md }, person: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' }, personText: { marginLeft: Spacing.sm, flex: 1 }, name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semiBold }, detail: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 }, help: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18, marginTop: Spacing.md }, actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base }, reject: { flex: 1, alignItems: 'center', borderColor: Colors.error, borderRadius: Radius.sm, borderWidth: 1, paddingVertical: Spacing.md }, rejectText: { color: Colors.error, fontWeight: FontWeight.semiBold }, accept: { flex: 2, alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.sm, justifyContent: 'center', paddingVertical: Spacing.md }, acceptText: { color: Colors.textInverse, fontWeight: FontWeight.semiBold },
});
