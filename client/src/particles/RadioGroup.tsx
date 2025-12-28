import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@hooks/useTheme';
import { Label, ErrorText } from './Typography';

interface RadioOption<T> {
  label: string;
  value: T;
}

interface RadioGroupProps<T> {
  label?: string;
  required?: boolean;
  options: readonly T[] | RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
}

export const RadioGroup = <T extends string | number>({
  label,
  required,
  options,
  value,
  onChange,
  error,
}: RadioGroupProps<T>) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    radioGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    radioButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    radioButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    radioButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    radioButtonTextActive: {
      color: colors.primary,
    },
  });

  // Normalize options to RadioOption format
  const normalizedOptions: RadioOption<T>[] = options.map((option) => {
    if (typeof option === 'object' && 'label' in option && 'value' in option) {
      return option as RadioOption<T>;
    }
    return { label: String(option), value: option as T };
  });

  return (
    <View>
      {label && <Label required={required}>{label}</Label>}
      <View style={styles.radioGroup}>
        {normalizedOptions.map((option) => {
          const isActive = value === option.value;
          return (
            <Pressable
              key={String(option.value)}
              style={[styles.radioButton, isActive && styles.radioButtonActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.radioButtonText, isActive && styles.radioButtonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
};

