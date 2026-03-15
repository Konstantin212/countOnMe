import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { BarcodeLookupStatus } from "@hooks/useBarcodeLookup";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles/index";

interface LookupStatusProps {
  status: BarcodeLookupStatus;
  error: string | null;
  onRetry: () => void;
}

const LookupStatus = ({ status, error, onRetry }: LookupStatusProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 12,
    },
    text: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textInverse,
      textAlign: "center",
    },
    errorText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.error,
      textAlign: "center",
    },
    retryButton: {
      width: 120,
    },
  });

  if (status === "loading") {
    return (
      <View style={styles.container} testID="lookup-loading">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>Looking up product...</Text>
      </View>
    );
  }

  if (status === "not_found") {
    return (
      <View style={styles.container} testID="lookup-not-found">
        <Text style={styles.text}>Product not found</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.container} testID="lookup-error">
        <Text style={styles.errorText}>{error ?? "Lookup failed"}</Text>
        <Button
          onPress={onRetry}
          variant="primary"
          fullWidth={false}
          style={styles.retryButton}
          testID="lookup-retry-btn"
        >
          Retry
        </Button>
      </View>
    );
  }

  // idle or found — render nothing
  return null;
};

export default LookupStatus;
