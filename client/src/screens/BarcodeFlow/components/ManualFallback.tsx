import React from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@particles/index";

interface ManualFallbackProps {
  onSearchByName: () => void;
  onEnterManually: () => void;
  visible: boolean;
}

const ManualFallback = ({
  onSearchByName,
  onEnterManually,
  visible,
}: ManualFallbackProps) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Button
        onPress={onSearchByName}
        variant="secondary"
        testID="fallback-search-btn"
      >
        Search by name
      </Button>
      <Button
        onPress={onEnterManually}
        variant="secondary"
        testID="fallback-manual-btn"
      >
        Enter manually
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 10,
  },
});

export default ManualFallback;
