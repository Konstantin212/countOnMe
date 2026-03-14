import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";
import { EnrichedFoodEntry, Unit } from "@models/types";
import { getCompatibleUnits } from "@services/utils/units";

interface EditEntryModalProps {
  visible: boolean;
  entry: EnrichedFoodEntry | null;
  onSave: (amount: number, unit: Unit) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export const EditEntryModal = ({
  visible,
  entry,
  onSave,
  onClose,
  saving,
}: EditEntryModalProps) => {
  const { colors } = useTheme();
  const [amount, setAmount] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<Unit>("g");
  const [error, setError] = useState<string | null>(null);

  // Reset state when entry changes
  React.useEffect(() => {
    if (entry) {
      setAmount(entry.amount.toString());
      setSelectedUnit(entry.unit);
      setError(null);
    }
  }, [entry]);

  const compatibleUnits = entry ? getCompatibleUnits(entry.unit) : [];

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }
    setError(null);
    await onSave(numAmount, selectedUnit);
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modal: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    productName: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textSecondary,
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: -12,
      marginBottom: 16,
    },
    unitContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 20,
    },
    unitButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    unitButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    unitText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    unitTextSelected: {
      color: colors.buttonText,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    button: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
    },
    cancelButtonText: {
      color: colors.text,
    },
    saveButtonText: {
      color: colors.buttonText,
    },
  });

  if (!entry) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Entry</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.productName}>{entry.productName}</Text>

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            placeholderTextColor={colors.textSecondary}
            editable={!saving}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>Unit</Text>
          <View style={styles.unitContainer}>
            {compatibleUnits.map((unit) => (
              <Pressable
                key={unit}
                style={[
                  styles.unitButton,
                  selectedUnit === unit && styles.unitButtonSelected,
                ]}
                onPress={() => setSelectedUnit(unit)}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.unitText,
                    selectedUnit === unit && styles.unitTextSelected,
                  ]}
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.saveButton,
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Text style={[styles.buttonText, styles.saveButtonText]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
