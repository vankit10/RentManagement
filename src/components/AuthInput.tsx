import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants';
import { logButtonPress } from '../utils/logger';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
}

export default function AuthInput({
  label,
  error,
  isPassword = false,
  ...textInputProps
}: AuthInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(isPassword);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          !!error && styles.inputWrapperError,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize={isPassword ? 'none' : textInputProps.autoCapitalize}
          autoCorrect={false}
          accessibilityLabel={label}
          {...textInputProps}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => {
              logButtonPress('AuthInput', isSecure ? 'show_password' : 'hide_password', { label });
              setIsSecure(prev => !prev);
            }}
            accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={isFocused ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && (
        <View style={styles.errorRow}>
          <Icon name="alert-circle-outline" size={13} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 4,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    flexShrink: 1,
  },
});
