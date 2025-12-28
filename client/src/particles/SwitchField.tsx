import React from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { useTheme } from '@hooks/useTheme';
import { Label, Subtitle, ErrorText } from './Typography';

interface SwitchFieldProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  error?: string;
}

export const SwitchField = ({ label, subtitle, value, onValueChange, error }: SwitchFieldProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    switchLabel: {
      flex: 1,
    },
  });

  return (
    <View>
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Label>{label}</Label>
          {subtitle && <Subtitle>{subtitle}</Subtitle>}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
          thumbColor={value ? '#2563eb' : '#f4f3f4'}
        />
      </View>
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
};

