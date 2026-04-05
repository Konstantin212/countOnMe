import React, { useState, useEffect, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@hooks/useTheme";
import type { FastingSession } from "@models/types";

type FastingWidgetProps = {
  activeSession: FastingSession | null;
  onPress: () => void;
};

const formatCountdown = (remainingMs: number): string => {
  if (remainingMs <= 0) return "00:00:00";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};

export const FastingWidget = ({
  activeSession,
  onPress,
}: FastingWidgetProps) => {
  const { colors } = useTheme();
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const computeRemaining = useCallback((): number => {
    if (!activeSession?.targetEndAt) return 0;
    return Math.max(
      new Date(activeSession.targetEndAt).getTime() - Date.now(),
      0,
    );
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) {
      setRemainingMs(0);
      return;
    }

    setRemainingMs(computeRemaining());

    if (activeSession.pausedAt !== null) return;

    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [activeSession, computeRemaining]);

  const styles = StyleSheet.create({
    card: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.fastingBg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 3,
      alignItems: "center",
      gap: 6,
    },
    icon: {
      marginBottom: 4,
    },
    value: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    technique: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.fastingAccent,
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    pausedText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  });

  return (
    <Pressable style={styles.card} onPress={onPress} testID="fasting-widget">
      <Ionicons
        name="timer-outline"
        size={24}
        color={colors.fastingAccent}
        style={styles.icon}
      />
      {activeSession ? (
        <>
          <Text style={styles.technique}>{activeSession.technique}</Text>
          {activeSession.pausedAt !== null ? (
            <Text testID="fasting-paused" style={styles.pausedText}>
              Paused
            </Text>
          ) : (
            <Text style={styles.value} testID="fasting-countdown">
              {formatCountdown(remainingMs)}
            </Text>
          )}
        </>
      ) : (
        <Text testID="fasting-no-active" style={styles.value}>
          Start
        </Text>
      )}
      <Text style={styles.label}>Fasting</Text>
    </Pressable>
  );
};
