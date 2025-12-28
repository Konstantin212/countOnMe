import React from 'react';
import { TextInputProps } from 'react-native';
import { Input } from './Input';

interface NumericInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label?: string;
  required?: boolean;
  error?: string;
  value: number | undefined;
  onChangeValue: (value: number | undefined) => void;
}

export const NumericInput = ({
  label,
  required,
  error,
  value,
  onChangeValue,
  ...props
}: NumericInputProps) => {
  const handleChange = (text: string) => {
    const num = parseFloat(text);
    onChangeValue(isNaN(num) ? undefined : num);
  };

  return (
    <Input
      label={label}
      required={required}
      error={error}
      value={value !== undefined ? String(value) : ''}
      onChangeText={handleChange}
      keyboardType="numeric"
      {...props}
    />
  );
};

