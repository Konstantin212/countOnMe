import React, { useState } from "react";
import { View, Pressable, Text, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@hooks/useTheme";
import { Label, ErrorText } from "./Typography";

interface SelectOption<T> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  label?: string;
  required?: boolean;
  options: SelectOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  error?: string;
  placeholder?: string;
  testID?: string;
}

export const Select = <T extends string>({
  label,
  required,
  options,
  value,
  onValueChange,
  error,
  placeholder = "Select...",
  testID = "select",
}: SelectProps<T>) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption?.label ?? placeholder;

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  const handleSelect = (optionValue: T) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  const styles = StyleSheet.create({
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: error ? colors.error : colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors.inputBackground,
    },
    triggerText: {
      fontSize: 16,
      color: selectedOption ? colors.text : colors.textTertiary,
      flex: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.overlay,
    },
    dropdown: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      width: "80%",
      maxHeight: "60%",
      paddingVertical: 8,
    },
    option: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    optionSelected: {
      backgroundColor: colors.primaryBg,
    },
    optionText: {
      fontSize: 16,
      color: colors.text,
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: "600",
    },
  });

  return (
    <View>
      {label && <Label required={required}>{label}</Label>}
      <Pressable style={styles.trigger} onPress={handleOpen} testID={testID}>
        <Text style={styles.triggerText}>{displayText}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.iconSecondary} />
      </Pressable>
      {error && <ErrorText>{error}</ErrorText>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
            testID={`${testID}-overlay`}
          />
          <View style={styles.dropdown}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelect(option.value)}
                  testID={`${testID}-option-${option.value}`}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
};
