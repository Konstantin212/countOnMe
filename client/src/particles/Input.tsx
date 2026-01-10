import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { useTheme } from '@hooks/useTheme';
import { Label, ErrorText } from './Typography';

interface InputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
}

export const Input = ({ label, required, error, style, ...props }: InputProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    inputError: {
      borderColor: colors.error,
      borderWidth: 2,
    },
  });

  return (
    <View>
      {label && <Label required={required}>{label}</Label>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textTertiary}
        {...props}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
};

