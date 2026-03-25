import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@services/auth/AuthContext";
import {
  getProfile,
  type UserDeviceResponse,
  type UserProfileResponse,
} from "@services/auth/authApi";
import { useTheme } from "@hooks/useTheme";
import { Button } from "@particles";

const AccountScreen = () => {
  const { colors } = useTheme();
  const auth = useAuth();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userEmail = auth.status === "authenticated" ? auth.user.email : null;

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProfile();
      setProfile(data);
    } catch {
      setError("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          try {
            await auth.signOut();
          } catch {
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "All your data will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await auth.deleteAccount();
                    } catch {
                      Alert.alert(
                        "Error",
                        "Failed to delete account. Please try again.",
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const renderDevice = ({ item }: { item: UserDeviceResponse }) => (
    <View style={styles.deviceCard}>
      <Ionicons name="phone-portrait-outline" size={20} color={colors.text} />
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {item.device_name ?? "Unknown device"}
        </Text>
        <Text style={styles.deviceMeta}>
          Linked {new Date(item.linked_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    header: {
      padding: 24,
      paddingBottom: 16,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    emailCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emailText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
    },
    deviceCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    deviceInfo: {
      marginLeft: 12,
      flex: 1,
    },
    deviceName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    deviceMeta: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 16,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: "center",
      paddingVertical: 16,
    },
    buttonSection: {
      marginTop: 8,
      gap: 12,
    },
    dangerSection: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    dangerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error,
    },
    dangerButtonPressed: {
      backgroundColor: colors.error + "10",
    },
    dangerButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.error,
      marginLeft: 8,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
      </View>

      <View style={styles.content}>
        {/* Email */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email</Text>
          <View style={styles.emailCard}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <Text style={styles.emailText}>{userEmail ?? "No email"}</Text>
          </View>
        </View>

        {/* Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linked Devices</Text>
          {isLoading && (
            <Text style={styles.loadingText}>Loading devices...</Text>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {profile?.devices && (
            <FlatList
              data={profile.devices}
              keyExtractor={(item) => item.id}
              renderItem={renderDevice}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Actions */}
        <View style={styles.buttonSection}>
          <Button
            testID="sign-out-button"
            variant="secondary"
            onPress={handleSignOut}
          >
            Sign Out
          </Button>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerSection}>
        <Pressable
          testID="delete-account-button"
          style={({ pressed }) => [
            styles.dangerButton,
            pressed && styles.dangerButtonPressed,
          ]}
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
          <Text style={styles.dangerButtonText}>Delete Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default AccountScreen;
