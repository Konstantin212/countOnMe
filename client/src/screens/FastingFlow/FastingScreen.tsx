import React, { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@hooks/useTheme";
import { useFasting } from "@hooks/useFasting";
import { Button } from "@particles";
import type { MyPathStackParamList } from "@app/navigationTypes";
import type { FastingSession } from "@models/types";

type NavigationProp = NativeStackNavigationProp<
  MyPathStackParamList,
  "FastingScreen"
>;
type FastingRouteProp = RouteProp<MyPathStackParamList, "FastingScreen">;

type TimerMode = "remaining" | "elapsed";

const padTwo = (n: number): string => String(Math.floor(n)).padStart(2, "0");

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const calculateProgress = (session: FastingSession, now: number): number => {
  const start = new Date(session.startedAt).getTime();
  const target = new Date(session.targetEndAt).getTime();
  const total = target - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

const FastingScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<FastingRouteProp>();
  const { sessionId } = route.params;
  const { sessions, endSession, loading } = useFasting();

  const [now, setNow] = useState(Date.now());
  const [timerMode, setTimerMode] = useState<TimerMode>("remaining");
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const session = sessions.find((s) => s.id === sessionId) ?? null;

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Refresh time when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setNow(Date.now());
      }
    });
    return () => subscription.remove();
  }, []);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleEndFast = async () => {
    setIsEnding(true);
    setEndError(null);
    try {
      await endSession(sessionId);
      navigation.goBack();
    } catch {
      setEndError("Failed to end fasting session. Please try again.");
    } finally {
      setIsEnding(false);
    }
  };

  const handleToggleMode = () => {
    setTimerMode((prev) => (prev === "remaining" ? "elapsed" : "remaining"));
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      padding: 4,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 12,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    techniqueBadge: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.fastingAccent,
      marginBottom: 24,
    },
    techniqueBadgeText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textInverse,
    },
    timerContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    timerLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    timerText: {
      fontSize: 56,
      fontWeight: "800",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    completedText: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.success,
    },
    toggleButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.fastingAccent,
      marginBottom: 32,
    },
    toggleText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.fastingAccent,
    },
    progressBarContainer: {
      width: "100%",
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      marginBottom: 16,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.fastingAccent,
    },
    progressText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 24,
      marginBottom: 32,
    },
    infoItem: {
      alignItems: "center",
    },
    infoLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    endButton: {
      width: "100%",
    },
    endErrorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: "center",
      marginBottom: 8,
    },
    // Summary styles for past sessions
    summaryCard: {
      width: "100%",
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      gap: 16,
    },
    summaryTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    summaryLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    completedBadge: {
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    completedBadgeSuccess: {
      backgroundColor: colors.successLight,
    },
    completedBadgeIncomplete: {
      backgroundColor: colors.warningLight,
    },
    completedBadgeText: {
      fontSize: 14,
      fontWeight: "700",
    },
    completedBadgeTextSuccess: {
      color: colors.success,
    },
    completedBadgeTextIncomplete: {
      color: colors.warning,
    },
  });

  if (!session) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            testID="back-button"
            onPress={handleGoBack}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Fasting</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={48}
            color={colors.textSecondary}
          />
          <Text testID="session-not-found" style={styles.errorText}>
            Fasting session not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isEnded = session.endedAt !== null;

  // Past/completed session summary view
  if (isEnded) {
    const durationMs =
      new Date(session.endedAt ?? session.targetEndAt).getTime() -
      new Date(session.startedAt).getTime();

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            testID="back-button"
            onPress={handleGoBack}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Fasting Summary</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {session.technique === "custom"
                ? `${session.fastingHours}h Custom`
                : session.technique}
            </Text>

            <View
              style={[
                styles.completedBadge,
                session.completed
                  ? styles.completedBadgeSuccess
                  : styles.completedBadgeIncomplete,
              ]}
            >
              <Text
                testID="completion-badge"
                style={[
                  styles.completedBadgeText,
                  session.completed
                    ? styles.completedBadgeTextSuccess
                    : styles.completedBadgeTextIncomplete,
                ]}
              >
                {session.completed ? "Completed" : "Ended Early"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Started</Text>
              <Text style={styles.summaryValue}>
                {formatDateTime(session.startedAt)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ended</Text>
              <Text style={styles.summaryValue}>
                {formatDateTime(session.endedAt ?? session.targetEndAt)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(durationMs)}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Active session view
  const elapsed = now - new Date(session.startedAt).getTime();
  const remaining = new Date(session.targetEndAt).getTime() - now;
  const isCompleted = remaining <= 0;
  const progress = calculateProgress(session, now);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          onPress={handleGoBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Fasting</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.techniqueBadge}>
          <Text testID="technique-badge" style={styles.techniqueBadgeText}>
            {session.technique === "custom"
              ? `${session.fastingHours}h Custom`
              : session.technique}
          </Text>
        </View>

        <View style={styles.timerContainer}>
          {isCompleted ? (
            <Text testID="completed-text" style={styles.completedText}>
              COMPLETED!
            </Text>
          ) : (
            <>
              <Text style={styles.timerLabel}>
                {timerMode === "remaining" ? "Time Remaining" : "Time Fasted"}
              </Text>
              <Text testID="timer-display" style={styles.timerText}>
                {timerMode === "remaining"
                  ? formatDuration(remaining)
                  : formatDuration(elapsed)}
              </Text>
            </>
          )}
        </View>

        {!isCompleted && (
          <Pressable
            testID="toggle-timer-mode"
            style={styles.toggleButton}
            onPress={handleToggleMode}
          >
            <Text style={styles.toggleText}>
              {timerMode === "remaining"
                ? "Show Time Fasted"
                : "Show Time Remaining"}
            </Text>
          </Pressable>
        )}

        <View style={styles.progressBarContainer}>
          <View
            testID="progress-bar-fill"
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, progress)}%` },
            ]}
          />
        </View>
        <Text testID="progress-text" style={styles.progressText}>
          {Math.round(progress)}% complete
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Started</Text>
            <Text style={styles.infoValue}>
              {formatTime(session.startedAt)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Target</Text>
            <Text style={styles.infoValue}>
              {formatTime(session.targetEndAt)}
            </Text>
          </View>
        </View>

        <View style={styles.endButton}>
          {endError && (
            <Text testID="end-error-text" style={styles.endErrorText}>
              {endError}
            </Text>
          )}
          <Button
            testID="end-fast-button"
            variant="danger"
            onPress={handleEndFast}
            disabled={isEnding || loading}
            loading={isEnding}
          >
            End Fast
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default FastingScreen;
