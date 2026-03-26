import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ModerationStatus, Visibility } from "@models/types";
import { useTheme } from "@hooks/useTheme";

interface PublishStatusBadgeProps {
  visibility: Visibility;
  moderationStatus: ModerationStatus;
}

type BadgeConfig = {
  label: string;
  bgKey:
    | "tertiaryBg"
    | "warningLight"
    | "successLight"
    | "errorLight"
    | "infoLight";
  textKey: "textSecondary" | "warning" | "success" | "error" | "info";
};

const getBadgeConfig = (
  visibility: Visibility,
  moderationStatus: ModerationStatus,
): BadgeConfig => {
  if (visibility === "private") {
    return { label: "Private", bgKey: "tertiaryBg", textKey: "textSecondary" };
  }

  if (visibility === "unlisted") {
    return { label: "Unlisted", bgKey: "infoLight", textKey: "info" };
  }

  // visibility === "public"
  switch (moderationStatus) {
    case "pending":
      return {
        label: "Pending Review",
        bgKey: "warningLight",
        textKey: "warning",
      };
    case "approved":
      return { label: "Published", bgKey: "successLight", textKey: "success" };
    case "rejected":
      return { label: "Rejected", bgKey: "errorLight", textKey: "error" };
  }
};

const PublishStatusBadge = ({
  visibility,
  moderationStatus,
}: PublishStatusBadgeProps) => {
  const { colors } = useTheme();
  const config = getBadgeConfig(visibility, moderationStatus);

  const styles = StyleSheet.create({
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors[config.bgKey],
    },
    text: {
      fontSize: 12,
      fontWeight: "600",
      color: colors[config.textKey],
    },
  });

  return (
    <View style={styles.badge} testID="publish-status-badge">
      <Text style={styles.text}>{config.label}</Text>
    </View>
  );
};

export default PublishStatusBadge;
