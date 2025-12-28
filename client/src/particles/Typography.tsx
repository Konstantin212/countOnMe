import React, { ReactNode } from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';
import { useTheme } from '@hooks/useTheme';

interface LabelProps extends TextProps {
  children: ReactNode;
  required?: boolean;
}

export const Label = ({ children, required, style, ...props }: LabelProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    required: {
      color: colors.error,
    },
  });

  return (
    <Text style={[styles.label, style]} {...props}>
      {children} {required && <Text style={styles.required}>*</Text>}
    </Text>
  );
};

interface ErrorTextProps extends TextProps {
  children: ReactNode;
}

export const ErrorText = ({ children, style, ...props }: ErrorTextProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    errorText: {
      color: colors.error,
      fontSize: 13,
      marginTop: 4,
    },
  });

  return (
    <Text style={[styles.errorText, style]} {...props}>
      {children}
    </Text>
  );
};

interface SectionTitleProps extends TextProps {
  children: ReactNode;
}

export const SectionTitle = ({ children, style, ...props }: SectionTitleProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
  });

  return (
    <Text style={[styles.sectionTitle, style]} {...props}>
      {children}
    </Text>
  );
};

interface SubtitleProps extends TextProps {
  children: ReactNode;
}

export const Subtitle = ({ children, style, ...props }: SubtitleProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  return (
    <Text style={[styles.subtitle, style]} {...props}>
      {children}
    </Text>
  );
};

