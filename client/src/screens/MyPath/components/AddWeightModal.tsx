import React, { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";
import { NumericInput } from "@particles";

const MIN_WEIGHT_KG = 1;
const MAX_WEIGHT_KG = 700;

interface AddWeightModalProps {
  visible: boolean;
  onClose: () => void;
  onLogWeight: (day: string, weightKg: number) => Promise<void>;
}

const formatToday = (): string => {
  const now = new Date();
  return now.toISOString().split("T")[0];
};

const formatDisplayDate = (isoDay: string): string => {
  const [year, month, day] = isoDay.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const AddWeightModal = ({
  visible,
  onClose,
  onLogWeight,
}: AddWeightModalProps) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const today = formatToday();
  const isWeightOutOfRange =
    weight !== undefined && (weight < MIN_WEIGHT_KG || weight > MAX_WEIGHT_KG);
  const isSaveDisabled =
    weight === undefined ||
    weight < MIN_WEIGHT_KG ||
    weight > MAX_WEIGHT_KG ||
    isSaving;

  const weightError = isWeightOutOfRange
    ? `Weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg`
    : undefined;

  const handleSave = async () => {
    if (
      weight === undefined ||
      weight < MIN_WEIGHT_KG ||
      weight > MAX_WEIGHT_KG
    )
      return;

    setIsSaving(true);
    try {
      await onLogWeight(today, weight);
      setWeight(undefined);
      onClose();
    } catch {
      Alert.alert("Error", "Failed to save weight. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setWeight(undefined);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: 320,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      padding: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    dateText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    inputContainer: {
      marginBottom: 24,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.border,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      backgroundColor: colors.disabled,
    },
    saveText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.buttonText,
    },
  });

  return (
    <Modal
      testID="add-weight-modal"
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Log Weight</Text>
            <Pressable
              testID="weight-modal-close"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.dateText}>{formatDisplayDate(today)}</Text>

          <View style={styles.inputContainer}>
            <NumericInput
              testID="weight-input"
              label="Weight (kg)"
              value={weight}
              onChangeValue={setWeight}
              placeholder="e.g. 74.2"
              error={weightError}
            />
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              testID="weight-cancel-button"
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="weight-save-button"
              style={[
                styles.saveButton,
                isSaveDisabled ? styles.saveButtonDisabled : undefined,
              ]}
              onPress={handleSave}
              disabled={isSaveDisabled}
            >
              <Text style={styles.saveText}>
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
