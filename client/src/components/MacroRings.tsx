import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

type MacroRingDatum = {
  label: string;
  progress: number; // uncapped ratio (0 = 0%, 1.0 = 100%, 1.5 = 150%)
  color: string; // hex color
};

type MacroRingsProps = {
  data: MacroRingDatum[];
  size?: number; // default: 220
  strokeWidth?: number; // default: 12
  baseRadius?: number; // default: 44
  ringGap?: number; // default: 20
};

/**
 * Darkens a hex color by the given amount.
 * @param hex - Hex color string (e.g., "#3B82F6" or "#FFF")
 * @param amount - Amount to darken (0 = no change, 1 = black)
 * @returns Darkened hex color (uppercase, 6-char)
 */
export const darkenHex = (hex: string, amount: number): string => {
  // Strip # prefix
  let normalized = hex.replace("#", "");

  // Expand 3-char hex (e.g., "FFF" -> "FFFFFF")
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Extract R, G, B
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  // Darken each channel and clamp to [0, 255]
  const darkenedR = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
  const darkenedG = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
  const darkenedB = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));

  // Convert back to hex (uppercase, 6-char with leading zeros)
  const toHex = (value: number) =>
    value.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(darkenedR)}${toHex(darkenedG)}${toHex(darkenedB)}`;
};

/**
 * MacroRings component — displays concentric progress rings with overflow support.
 * Progress values >1.0 show an additional darkened arc representing overconsumption.
 */
export const MacroRings: React.FC<MacroRingsProps> = ({
  data,
  size = 220,
  strokeWidth = 12,
  baseRadius = 44,
  ringGap = 20,
}) => {
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={ringStyles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((datum, i) => {
          const radius = baseRadius + i * ringGap;
          const circumference = 2 * Math.PI * radius;

          // Main arc progress (capped at 1.0)
          const mainProgress = Math.min(datum.progress, 1);
          const mainDashoffset = circumference * (1 - mainProgress);

          // Overflow arc (only if progress > 1.0)
          const hasOverflow = datum.progress > 1;
          const overflowFraction = hasOverflow
            ? Math.min(datum.progress - 1, 1)
            : 0;
          const overflowDashoffset = circumference * (1 - overflowFraction);
          const overflowColor = darkenHex(datum.color, 0.25);

          return (
            <React.Fragment key={i}>
              {/* 1. Background track */}
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={datum.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.2}
                rotation={-90}
                origin={`${cx}, ${cy}`}
                testID={`ring-${i}-bg`}
              />

              {/* 2. Main arc (up to 100%) */}
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={datum.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={mainDashoffset}
                rotation={-90}
                origin={`${cx}, ${cy}`}
                testID={`ring-${i}-main`}
              />

              {/* 3. Overflow arc (only if progress > 1) */}
              {hasOverflow && (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={overflowColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={overflowDashoffset}
                  rotation={-90}
                  origin={`${cx}, ${cy}`}
                  testID={`ring-${i}-overflow`}
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

const ringStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
});

export default MacroRings;
