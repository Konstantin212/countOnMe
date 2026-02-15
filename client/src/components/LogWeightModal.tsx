import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles/Button";
import { NumericInput } from "@particles/NumericInput";

const MAX_WEIGHT_KG = 500;

type LogWeightModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (day: string, weightKg: number) => Promise<void>;
  initialWeight?: number;
};

export const LogWeightModal = ({
  visible,
  onClose,
  onSave,
  initialWeight,
}: LogWeightModalProps) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState<number | undefined>(initialWeight);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setError(null);
      setIsLoading(false);
    }
  }, [visible, initialWeight]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    modalCard: {
      width: "85%",
      maxWidth: 400,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 24,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      elevation: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    dateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: "center",
    },
    buttonsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    buttonWrapper: {
      flex: 1,
    },
  });

  const handleSave = async () => {
    // Validate weight
    if (weight === undefined || weight <= 0) {
      setError("Please enter a valid weight");
      return;
    }

    if (weight >= MAX_WEIGHT_KG) {
      setError(`Weight must be less than ${MAX_WEIGHT_KG} kg`);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      await onSave(today, weight);
      onClose();
    } catch (err) {
      setError("Failed to save weight. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.overlay} onPress={handleCancel}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              <Text style={styles.title}>Log Weight</Text>
              <Text style={styles.dateText}>{todayFormatted}</Text>

              <NumericInput
                label="Weight (kg)"
                value={weight}
                onChangeValue={setWeight}
                placeholder="Enter weight"
                testID="weight-input"
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.buttonsRow}>
                <View style={styles.buttonWrapper}>
                  <Button
                    variant="secondary"
                    onPress={handleCancel}
                    disabled={isLoading}
                    testID="cancel-button"
                  >
                    Cancel
                  </Button>
                </View>
                <View style={styles.buttonWrapper}>
                  <Button
                    variant="primary"
                    onPress={handleSave}
                    loading={isLoading}
                    disabled={isLoading}
                    testID="save-button"
                  >
                    Save
                  </Button>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
