import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useSyncStatus } from '@hooks/useSyncStatus';
import { useTheme } from '@hooks/useTheme';
import { ThemeMode } from '@theme/ThemeContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMenu'>;

const ProfileScreen = ({ navigation }: Props) => {
  const { colors, themeMode, setThemeMode, theme } = useTheme();
  const sync = useSyncStatus();

  const themeOptions: { id: ThemeMode; title: string; subtitle: string; icon: any }[] = [
    {
      id: 'light',
      title: 'Light',
      subtitle: 'Always use light theme',
      icon: 'sunny',
    },
    {
      id: 'dark',
      title: 'Dark',
      subtitle: 'Always use dark theme',
      icon: 'moon',
    },
    {
      id: 'system',
      title: 'System Default',
      subtitle: 'Follow device settings',
      icon: 'phone-portrait',
    },
  ];

  const menuItems = [
    {
      id: 'products',
      title: 'My Products',
      subtitle: 'Manage your food database',
      icon: 'basket' as const,
      onPress: () => navigation.navigate('ProductsList'),
    },
    {
      id: 'meals',
      title: 'My Meals',
      subtitle: 'View and manage your meals',
      icon: 'restaurant' as const,
      onPress: () => navigation.navigate('MealsList'),
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      padding: 24,
      paddingBottom: 16,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    section: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 8,
    },
    themeDebug: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: 8,
      paddingHorizontal: 8,
    },
    themeWarning: {
      fontSize: 12,
      color: colors.info,
      backgroundColor: colors.infoLight,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      marginHorizontal: 8,
      lineHeight: 18,
    },
    syncCard: {
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    syncRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    syncLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    syncValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
      maxWidth: '65%',
      textAlign: 'right',
    },
    syncError: {
      marginTop: 8,
      fontSize: 12,
      color: colors.error,
      lineHeight: 16,
    },
    syncButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    syncButtonDisabled: {
      backgroundColor: colors.disabled,
    },
    syncButtonText: {
      color: colors.buttonText,
      fontWeight: '700',
      fontSize: 14,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: colors.border,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    themeIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    themeIconContainerActive: {
      backgroundColor: colors.primary + '20',
    },
    themeContent: {
      flex: 1,
    },
    themeTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    themeSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    checkIcon: {
      marginLeft: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuItemPressed: {
      backgroundColor: colors.pressed,
    },
    menuIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    menuContent: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    menuSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your nutrition data</Text>
        </View>

        {/* Theme Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <Text style={styles.themeDebug}>
            Currently using: {theme === 'dark' ? 'Dark' : 'Light'} theme
          </Text>
          {themeMode === 'system' && theme === 'light' && (
            <Text style={styles.themeWarning}>
              If your phone is in dark mode but the app shows light, manually select "Dark" below.
              Some Android devices don't report system theme correctly.
            </Text>
          )}
          {themeOptions.map((option) => (
            <Pressable
              key={option.id}
              style={[
                styles.themeOption,
                themeMode === option.id && styles.themeOptionActive,
              ]}
              onPress={() => setThemeMode(option.id)}
            >
              <View
                style={[
                  styles.themeIconContainer,
                  themeMode === option.id && styles.themeIconContainerActive,
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={themeMode === option.id ? colors.primary : colors.iconSecondary}
                />
              </View>
              <View style={styles.themeContent}>
                <Text style={styles.themeTitle}>{option.title}</Text>
                <Text style={styles.themeSubtitle}>{option.subtitle}</Text>
              </View>
              {themeMode === option.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} style={styles.checkIcon} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Backend</Text>
              <Text style={styles.syncValue}>{sync.baseUrl}</Text>
            </View>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Device</Text>
              <Text style={styles.syncValue}>{sync.deviceId ? sync.deviceId.slice(0, 8) : '-'}</Text>
            </View>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Token</Text>
              <Text style={styles.syncValue}>{sync.hasToken ? 'Saved' : 'Missing (will register)'}</Text>
            </View>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Status</Text>
              <Text style={styles.syncValue}>{sync.isOnline ? 'Online' : 'Offline'}</Text>
            </View>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Queue</Text>
              <Text style={styles.syncValue}>{sync.queueSize}</Text>
            </View>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Last sync</Text>
              <Text style={styles.syncValue}>
                {sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString() : '-'}
              </Text>
            </View>
            {sync.lastError && <Text style={styles.syncError}>Last error: {sync.lastError}</Text>}
            <Pressable
              style={[
                styles.syncButton,
                (sync.flushing || !sync.isOnline) && styles.syncButtonDisabled,
              ]}
              disabled={sync.flushing || !sync.isOnline}
              onPress={sync.flushNow}
            >
              <Text style={styles.syncButtonText}>
                {sync.flushing ? 'Syncing…' : 'Sync now'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* My Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Data</Text>
          {menuItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={item.onPress}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.iconSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

