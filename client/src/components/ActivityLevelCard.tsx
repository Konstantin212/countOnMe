import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@hooks/useTheme';
import { ActivityLevel } from '@models/types';
import { ActivityLevelInfo } from '@services/constants/activityLevels';

interface ActivityLevelCardProps {
  level: ActivityLevelInfo;
  selected: boolean;
  onSelect: () => void;
}

export const ActivityLevelCard = ({
  level,
  selected,
  onSelect,
}: ActivityLevelCardProps) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: selected ? colors.primary : colors.border,
      overflow: 'hidden',
    },
    cardSelected: {
      backgroundColor: colors.primary + '08',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    radioOuter: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: selected ? colors.primary : colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    icon: {
      fontSize: 20,
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    shortDesc: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    expandButton: {
      padding: 4,
    },
    details: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    detailedDesc: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginBottom: 12,
    },
    examplesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    example: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      paddingLeft: 8,
    },
  });

  return (
    <Pressable onPress={onSelect} style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.header}>
        {/* Radio button */}
        <View style={styles.radioOuter}>
          {selected && <View style={styles.radioInner} />}
        </View>

        {/* Icon */}
        <Text style={styles.icon}>{level.icon}</Text>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.label}>{level.label}</Text>
          <Text style={styles.shortDesc}>{level.shortDescription}</Text>
        </View>

        {/* Expand button */}
        <Pressable onPress={toggleExpand} style={styles.expandButton}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.iconSecondary}
          />
        </Pressable>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailedDesc}>{level.detailedDescription}</Text>
          <Text style={styles.examplesTitle}>Examples:</Text>
          {level.examples.map((example, index) => (
            <Text key={index} style={styles.example}>
              • {example}
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
};

export default ActivityLevelCard;
