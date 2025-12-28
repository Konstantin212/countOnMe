import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface FormFieldProps {
  children: ReactNode;
}

export const FormField = ({ children }: FormFieldProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  });

  return <View style={styles.section}>{children}</View>;
};

