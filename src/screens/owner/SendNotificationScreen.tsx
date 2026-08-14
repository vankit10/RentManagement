import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import AuthInput from '../../components/AuthInput';
import { sendNotification, broadcastNotification } from '../../services/notificationService';
import { getAllTenants } from '../../services/tenantService';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import type { NotificationType, OwnerStackParamList, Tenant } from '../../types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'SendNotification'>;

const NOTIFICATION_TYPES: { value: NotificationType; label: string; icon: string; color: string }[] = [
  { value: 'general',              label: 'General',              icon: 'bell-outline',              color: Colors.primary  },
  { value: 'rent_reminder',        label: 'Rent Reminder',        icon: 'calendar-clock',            color: Colors.info     },
  { value: 'overdue_alert',        label: 'Overdue Alert',        icon: 'alert-circle-outline',      color: Colors.error    },
  { value: 'electricity_bill',     label: 'Electricity Bill',     icon: 'lightning-bolt-outline',    color: Colors.warning  },
  { value: 'payment_confirmation', label: 'Payment Confirmation', icon: 'check-circle-outline',      color: Colors.success  },
];

export default function SendNotificationScreen({ route, navigation }: Props) {
  const preselectedTenantId = route.params?.tenantId ?? null;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    preselectedTenantId,
  );
  const [broadcastAll, setBroadcastAll] = useState(false);
  const [notifType, setNotifType] = useState<NotificationType>('general');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [titleError, setTitleError] = useState('');
  const [messageError, setMessageError] = useState('');

  useEffect(() => {
    getAllTenants()
      .then(data => {
        setTenants(data.filter(t => t.status === 'active'));
      })
      .catch(err => console.warn('[SendNotification] load tenants error:', err))
      .finally(() => setIsLoadingTenants(false));
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    let valid = true;
    if (!title.trim()) {
      setTitleError('Title is required.');
      valid = false;
    } else { setTitleError(''); }

    if (!message.trim()) {
      setMessageError('Message is required.');
      valid = false;
    } else { setMessageError(''); }

    if (!broadcastAll && !selectedTenantId) {
      Alert.alert('Select Recipient', 'Please select a tenant or choose "All Tenants".');
      valid = false;
    }
    return valid;
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!validate()) { return; }
    setIsSending(true);
    try {
      if (broadcastAll) {
        await broadcastNotification(
          title.trim(),
          message.trim(),
          notifType,
          tenants.map(t => t.id),
        );
        Toast.show({
          type: 'success',
          text1: 'Sent to All Tenants',
          text2: `${tenants.length} tenant${tenants.length > 1 ? 's' : ''} notified.`,
          position: 'top',
        });
      } else {
        await sendNotification({
          tenantId: selectedTenantId!,
          title: title.trim(),
          message: message.trim(),
          type: notifType,
        });
        const name = tenants.find(t => t.id === selectedTenantId)?.name ?? 'Tenant';
        Toast.show({
          type: 'success',
          text1: 'Notification Sent',
          text2: `Sent to ${name}.`,
          position: 'top',
        });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Failed', getFirebaseErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastAll, selectedTenantId, title, message, notifType, tenants, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={Colors.textInverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Notification</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Recipient ─────────────────────────────── */}
          <Text style={styles.groupLabel}>RECIPIENT</Text>
          <View style={styles.card}>
            {/* Broadcast toggle */}
            <TouchableOpacity
              style={[styles.broadcastRow, broadcastAll && styles.broadcastRowActive]}
              onPress={() => { setBroadcastAll(p => !p); setSelectedTenantId(null); }}
              accessibilityLabel="Send to all tenants"
            >
              <Icon
                name={broadcastAll ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={22}
                color={broadcastAll ? Colors.accent : Colors.textMuted}
              />
              <View style={styles.broadcastText}>
                <Text style={styles.broadcastLabel}>All Active Tenants</Text>
                <Text style={styles.broadcastSub}>{tenants.length} tenants will receive this</Text>
              </View>
            </TouchableOpacity>

            {!broadcastAll && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or select one</Text>
                  <View style={styles.orLine} />
                </View>

                {isLoadingTenants ? (
                  <View style={styles.tenantLoading}>
                    <ActivityIndicator size="small" color={Colors.accent} />
                  </View>
                ) : (
                  tenants.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.tenantRow,
                        selectedTenantId === t.id && styles.tenantRowActive,
                      ]}
                      onPress={() => setSelectedTenantId(t.id)}
                      accessibilityLabel={`Select tenant ${t.name}`}
                    >
                      <View style={styles.tenantAvatar}>
                        <Text style={styles.tenantAvatarText}>
                          {t.name.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')}
                        </Text>
                      </View>
                      <View style={styles.tenantInfo}>
                        <Text style={styles.tenantName}>{t.name}</Text>
                        <Text style={styles.tenantMeta}>Room {t.roomNumber}</Text>
                      </View>
                      {selectedTenantId === t.id && (
                        <Icon name="check-circle" size={20} color={Colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}
          </View>

          {/* ── Notification type ─────────────────────── */}
          <Text style={styles.groupLabel}>TYPE</Text>
          <View style={styles.typeGrid}>
            {NOTIFICATION_TYPES.map(nt => (
              <TouchableOpacity
                key={nt.value}
                style={[
                  styles.typeChip,
                  notifType === nt.value && { borderColor: nt.color, backgroundColor: `${nt.color}18` },
                ]}
                onPress={() => setNotifType(nt.value)}
                accessibilityLabel={`Type: ${nt.label}`}
              >
                <Icon name={nt.icon} size={16} color={notifType === nt.value ? nt.color : Colors.textMuted} />
                <Text style={[styles.typeChipText, notifType === nt.value && { color: nt.color, fontWeight: FontWeight.semiBold }]}>
                  {nt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Message ───────────────────────────────── */}
          <Text style={styles.groupLabel}>MESSAGE</Text>
          <View style={styles.card}>
            <AuthInput
              label="Title"
              placeholder="e.g. Rent Due Reminder"
              value={title}
              onChangeText={v => { setTitle(v); if (titleError) { setTitleError(''); } }}
              error={titleError}
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={80}
            />

            <Text style={styles.inputLabel}>Message</Text>
            <View style={[styles.messageWrap, messageError ? styles.messageWrapError : null]}>
              <TextInput
                style={styles.messageInput}
                placeholder="Write your message here…"
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={v => { setMessage(v); if (messageError) { setMessageError(''); } }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
                accessibilityLabel="Message body"
              />
            </View>
            {!!messageError && (
              <View style={styles.errRow}>
                <Icon name="alert-circle-outline" size={13} color={Colors.error} />
                <Text style={styles.errText}>{messageError}</Text>
              </View>
            )}
            <Text style={styles.charCount}>{message.length}/500</Text>
          </View>

          {/* ── Send button ───────────────────────────── */}
          <TouchableOpacity
            style={[styles.sendBtn, isSending && styles.btnDisabled]}
            onPress={handleSend}
            disabled={isSending}
            accessibilityLabel="Send notification"
            accessibilityRole="button"
          >
            {isSending
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <>
                  <Icon name="send" size={20} color={Colors.textInverse} />
                  <Text style={styles.sendBtnText}>
                    {broadcastAll ? `Send to All (${tenants.length})` : 'Send Notification'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textInverse, textAlign: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  groupLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },

  // Broadcast row
  broadcastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  broadcastRowActive: { borderColor: Colors.accent, backgroundColor: '#FEF8EC' },
  broadcastText: { flex: 1 },
  broadcastLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  broadcastSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  // Or divider
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Tenant rows
  tenantLoading: { alignItems: 'center', padding: Spacing.md },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tenantRowActive: { borderColor: Colors.accent, backgroundColor: '#FEF8EC' },
  tenantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  tenantMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typeChipText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Message input
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  messageWrap: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    minHeight: 110,
  },
  messageWrapError: { borderColor: Colors.error },
  messageInput: {
    padding: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    minHeight: 100,
  },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  errText: { fontSize: FontSize.xs, color: Colors.error },
  charCount: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right', marginTop: 4 },

  // Send button
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 50,
    marginTop: Spacing.lg,
  },
  btnDisabled: { opacity: 0.7 },
  sendBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse, letterSpacing: 0.3 },
});
