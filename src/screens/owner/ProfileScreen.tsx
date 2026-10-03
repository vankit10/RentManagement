import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import AuthInput from '../../components/AuthInput';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { OwnerStackParamList } from '../../types';

export default function OwnerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const { user, logout, updateProfile } = useAuth();
  const profile = user?.profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your full name.'); return; }
    setIsSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() });
      Alert.alert('Profile Updated', 'Your profile details have been saved.');
    } catch (err) {
      Alert.alert('Update Failed', getSupabaseErrorMessage(err, 'updating your profile'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar}><Icon name="account-tie" size={38} color={Colors.textInverse} /></View>
        <View><Text style={styles.title}>Owner Profile</Text><Text style={styles.sub}>Manage your account details</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <AuthInput label="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <AuthInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <AuthInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Text style={styles.note}>These changes update your profile details. Your login email is managed separately by Supabase Authentication.</Text>
          <TouchableOpacity style={styles.save} onPress={save} disabled={isSaving} accessibilityLabel="Save owner profile">
            <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.requests} onPress={() => navigation.navigate('AccessRequests')} accessibilityLabel="Review tenant access requests">
          <View style={styles.requestsIcon}><Icon name="email-receive-outline" size={22} color={Colors.primary} /></View>
          <View style={styles.requestsText}><Text style={styles.requestsTitle}>Tenant Access Requests</Text><Text style={styles.requestsSub}>Accept or reject tenant requests</Text></View>
          <Icon name="chevron-right" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.logout} onPress={logout} accessibilityLabel="Sign out">
          <Icon name="logout" size={20} color={Colors.error} /><Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.accentDark, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  sub: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },
  content: { padding: Spacing.base },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base },
  note: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18, marginTop: -Spacing.sm, marginBottom: Spacing.base },
  save: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: Spacing.md },
  saveText: { color: Colors.textInverse, fontWeight: FontWeight.semiBold },
  requests: { marginTop: Spacing.base, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base },
  requestsIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  requestsText: { flex: 1, marginLeft: Spacing.md },
  requestsTitle: { color: Colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  requestsSub: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  logout: { marginTop: Spacing.base, flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.errorLight, borderRadius: Radius.md, paddingVertical: Spacing.md },
  logoutText: { color: Colors.error, fontWeight: FontWeight.semiBold },
});
