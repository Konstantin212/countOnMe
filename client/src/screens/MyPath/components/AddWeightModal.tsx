import React, { useState, useEffect } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";
import { NumericInput } from "@particles";
import type { BodyWeightEntry } from "@models/types";

const MIN_WEIGHT_KG = 1;
const MAX_WEIGHT_KG = 700;

interface AddWeightModalProps {
  visible: boolean;
  onClose: () => void;
  onLogWeight: (day: string, weightKg: number) => Promise<void>;
  weights: BodyWeightEntry[];
}

const toLocalISODay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatToday = (): string => toLocalISODay(new Date());

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

const shiftDay = (isoDay: string, delta: number): string => {
  const [year, month, day] = isoDay.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  date.setDate(date.getDate() + delta);
  return toLocalISODay(date);
};

export const AddWeightModal = ({
  visible,
  onClose,
  onLogWeight,
  weights,
}: AddWeightModalProps) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState<number | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<string>(formatToday);
  const [isSaving, setIsSaving] = useState(false);

  // Reset to today when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDay(formatToday());
    }
  }, [visible]);

  // Pre-fill weight for selected day
  useEffect(() => {
    const existing = weights.find((w) => w.day === selectedDay);
    setWeight(existing?.weightKg);
  }, [selectedDay, weights]);

  const today = formatToday();
  const isNextDayDisabled = selectedDay >= today;
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

  const handlePrevDay = () => {
    setSelectedDay((prev) => shiftDay(prev, -1));
  };

  const handleNextDay = () => {
    if (isNextDayDisabled) return;
    setSelectedDay((prev) => shiftDay(prev, 1));
  };

  const handleSave = async () => {
    if (
      weight === undefined ||
      weight < MIN_WEIGHT_KG ||
      weight > MAX_WEIGHT_KG
    )
      return;

    setIsSaving(true);
    try {
      await onLogWeight(selectedDay, weight);
      setWeight(undefined);
      setSelectedDay(formatToday());
      onClose();
    } catch {
      Alert.alert("Error", "Failed to save weight. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setWeight(undefined);
    setSelectedDay(formatToday());
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
    datePicker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    dateText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    dateArrow: {
      padding: 4,
    },
    dateArrowDisabled: {
      opacity: 0.3,
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

          <View style={styles.datePicker}>
            <Pressable
              testID="date-prev-button"
              onPress={handlePrevDay}
              style={styles.dateArrow}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
            <Text style={styles.dateText}>
              {formatDisplayDate(selectedDay)}
            </Text>
            <Pressable
              testID="date-next-button"
              onPress={handleNextDay}
              disabled={isNextDayDisabled}
              style={[
                styles.dateArrow,
                isNextDayDisabled ? styles.dateArrowDisabled : undefined,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

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
