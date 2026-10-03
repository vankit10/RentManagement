import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TextInput, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../constants';
import { createAccessRequest } from '../services/tenantService';

/**
 * Shown on tenant screens when no tenant record is linked to the logged-in
 * user — i.e. the owner hasn't registered / assigned them yet.
 */
export default function NoOwnerBanner() {
  const [ownerEmail, setOwnerEmail] = useState('');

  const requestAccess = async () => {
    const email = ownerEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Enter an email address', 'Please enter a valid owner or property manager email address.');
      return;
    }

    try {
      await createAccessRequest(email);
      setOwnerEmail('');
      Alert.alert('Request sent', 'Your owner can now review your request in the app.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check the owner email address and try again.';
      Alert.alert('Could not send request', message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="account-alert-outline" size={48} color={Colors.accent} />
      </View>
      <Text style={styles.title}>Request access to your property</Text>
      <Text style={styles.body}>
        Your account has not been linked to a property yet. Enter your owner or property manager’s email address to ask them to add you.
      </Text>
      <TextInput
        value={ownerEmail}
        onChangeText={setOwnerEmail}
        placeholder="Owner’s email address"
        placeholderTextColor={Colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.emailInput}
        accessibilityLabel="Owner email address"
      />
      <TouchableOpacity
        style={styles.requestButton}
        onPress={requestAccess}
        accessibilityLabel="Send access request to owner"
      >
        <Icon name="email-send-outline" size={18} color={Colors.textInverse} />
        <Text style={styles.requestButtonText}>Request access</Text>
      </TouchableOpacity>
      <View style={styles.hint}>
        <Icon name="information-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.hintText}>
          Your owner can accept the request in the app, then add your room, rent, and other details.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentLight ?? '#FEF6E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  emailInput: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  requestButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  requestButtonText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceSecondary ?? Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight ?? Colors.border,
    maxWidth: 320,
  },
  hintText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
