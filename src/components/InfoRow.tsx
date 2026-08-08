import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, FontSize, FontWeight, Spacing } from '../constants';

interface Props {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  /** Render any node on the right instead of a plain value string */
  rightNode?: React.ReactNode;
}

export default function InfoRow({ icon, label, value, valueColor, rightNode }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={18} color={Colors.primary} />
      </View>
      <Text style={styles.label}>{label}</Text>
      {rightNode ?? (
        <Text
          style={[styles.value, valueColor ? { color: valueColor } : null]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
});
