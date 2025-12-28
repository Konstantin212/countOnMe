import React, { ReactNode } from 'react';
import { Pressable, Text, StyleSheet, PressableProps, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ButtonProps extends PressableProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = ({
  children,
  variant = 'primary',
  fullWidth = true,
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    button: {
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      ...(fullWidth && { width: '100%' }),
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.border,
    },
    danger: {
      backgroundColor: colors.error,
    },
    disabled: {
      backgroundColor: colors.disabled,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryText: {
      color: colors.buttonText,
    },
    secondaryText: {
      color: colors.text,
    },
    dangerText: {
      color: colors.buttonText,
    },
  });

  const getButtonStyle = (): ViewStyle[] => {
    const baseStyles = [styles.button];
    if (disabled || loading) {
      baseStyles.push(styles.disabled);
    } else {
      switch (variant) {
        case 'primary':
          baseStyles.push(styles.primary);
          break;
        case 'secondary':
          baseStyles.push(styles.secondary);
          break;
        case 'danger':
          baseStyles.push(styles.danger);
          break;
      }
    }
    return baseStyles;
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'danger':
        return styles.dangerText;
    }
  };

  return (
    <Pressable
      style={[...getButtonStyle(), style]}
      disabled={disabled || loading}
      {...props}
    >
      <Text style={[styles.buttonText, getTextStyle()]}>
        {loading ? 'Loading...' : children}
      </Text>
    </Pressable>
  );
};

