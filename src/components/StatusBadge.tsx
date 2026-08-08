import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusColors } from '../utils/helpers';
import { FontSize, FontWeight, Radius, Spacing } from '../constants';
import type { RentStatus } from '../types';

interface Props {
  status: RentStatus;
}

export default function StatusBadge({ status }: Props) {
  const { background, text } = getStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
  },
});
