import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { MyDayStackParamList } from '@app/navigationTypes';
import { useMealTypeEntries } from '@hooks/useMealTypeEntries';
import { useTheme } from '@hooks/useTheme';
import { EnrichedFoodEntry, Unit } from '@models/types';
import { MEAL_TYPE_LABEL } from '@services/constants/mealTypes';
import { getCompatibleUnits } from '@services/utils/units';

type Props = NativeStackScreenProps<MyDayStackParamList, 'MealTypeEntries'>;

// ============================================================================
// Entry List Item Component
// ============================================================================

interface EntryListItemProps {
  entry: EnrichedFoodEntry;
  onEdit: () => void;
  onDelete: () => void;
}

const EntryListItem = ({ entry, onEdit, onDelete }: EntryListItemProps) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    content: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    details: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    macros: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.cardBackgroundLight,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.name}>{entry.productName}</Text>
        <Text style={styles.details}>
          {entry.amount} {entry.unit} • {entry.calories} kcal
        </Text>
        <Text style={styles.macros}>
          P: {entry.protein}g  C: {entry.carbs}g  F: {entry.fat}g
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          onPress={onEdit}
          accessibilityLabel="Edit entry"
        >
          <Ionicons name="pencil" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          onPress={onDelete}
          accessibilityLabel="Delete entry"
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
};

// ============================================================================
// Edit Entry Modal Component
// ============================================================================

interface EditEntryModalProps {
  visible: boolean;
  entry: EnrichedFoodEntry | null;
  onSave: (amount: number, unit: Unit) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

const EditEntryModal = ({ visible, entry, onSave, onClose, saving }: EditEntryModalProps) => {
  const { colors } = useTheme();
  const [amount, setAmount] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit>('g');
  const [error, setError] = useState<string | null>(null);

  // Reset state when entry changes
  React.useEffect(() => {
    if (entry) {
      setAmount(entry.amount.toString());
      setSelectedUnit(entry.unit);
      setError(null);
    }
  }, [entry]);

  const compatibleUnits = entry ? getCompatibleUnits(entry.unit) : [];

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    setError(null);
    await onSave(numAmount, selectedUnit);
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modal: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    productName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: -12,
      marginBottom: 16,
    },
    unitContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    unitButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    unitButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    unitText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    unitTextSelected: {
      color: colors.buttonText,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    button: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.text,
    },
    saveButtonText: {
      color: colors.buttonText,
    },
  });

  if (!entry) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Entry</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.productName}>{entry.productName}</Text>

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            placeholderTextColor={colors.textSecondary}
            editable={!saving}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>Unit</Text>
          <View style={styles.unitContainer}>
            {compatibleUnits.map((unit) => (
              <Pressable
                key={unit}
                style={[styles.unitButton, selectedUnit === unit && styles.unitButtonSelected]}
                onPress={() => setSelectedUnit(unit)}
                disabled={saving}
              >
                <Text style={[styles.unitText, selectedUnit === unit && styles.unitTextSelected]}>
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================================================
// Main Screen Component
// ============================================================================

const MealTypeEntriesScreen = ({ navigation, route }: Props) => {
  const { mealType } = route.params;
  const { colors } = useTheme();
  const { entries, loading, error, updateEntry, deleteEntry, refresh } =
    useMealTypeEntries(mealType);

  const [editingEntry, setEditingEntry] = useState<EnrichedFoodEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const mealTypeLabel = MEAL_TYPE_LABEL[mealType];

  // Calculate totals
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const totalProtein = entries.reduce((sum, e) => sum + e.protein, 0);
  const totalCarbs = entries.reduce((sum, e) => sum + e.carbs, 0);
  const totalFat = entries.reduce((sum, e) => sum + e.fat, 0);

  const handleEdit = useCallback((entry: EnrichedFoodEntry) => {
    setEditingEntry(entry);
  }, []);

  const handleDelete = useCallback(
    (entry: EnrichedFoodEntry) => {
      Alert.alert(
        'Delete Entry?',
        `Are you sure you want to delete "${entry.productName}" (${entry.amount}${entry.unit})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteEntry(entry.id);
              if (!success) {
                Alert.alert('Error', 'Failed to delete entry. Please try again.');
              }
            },
          },
        ],
      );
    },
    [deleteEntry],
  );

  const handleSaveEdit = useCallback(
    async (amount: number, unit: Unit) => {
      if (!editingEntry) return;

      setSaving(true);
      const success = await updateEntry(editingEntry.id, amount, unit);
      setSaving(false);

      if (success) {
        setEditingEntry(null);
      } else {
        Alert.alert('Error', 'Failed to update entry. Please try again.');
      }
    },
    [editingEntry, updateEntry],
  );

  const handleCloseModal = useCallback(() => {
    if (!saving) {
      setEditingEntry(null);
    }
  }, [saving]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
    },
    topBarTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    summaryCard: {
      backgroundColor: colors.infoLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.info,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.info,
      marginBottom: 8,
    },
    summaryCalories: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.info,
      marginBottom: 8,
    },
    summaryMacros: {
      fontSize: 14,
      color: colors.info,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    listContent: {
      paddingBottom: 24,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const renderItem = useCallback(
    ({ item }: { item: EnrichedFoodEntry }) => (
      <EntryListItem entry={item} onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />
    ),
    [handleEdit, handleDelete],
  );

  const keyExtractor = useCallback((item: EnrichedFoodEntry) => item.id, []);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="restaurant-outline"
        size={64}
        color={colors.textSecondary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>No {mealTypeLabel.toLowerCase()} entries yet</Text>
      <Text style={styles.emptySubtitle}>
        Add food to your {mealTypeLabel.toLowerCase()} from the My Day screen
      </Text>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error && entries.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (entries.length === 0) {
      return renderEmpty();
    }

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total for {mealTypeLabel}</Text>
          <Text style={styles.summaryCalories}>{totalCalories} kcal</Text>
          <Text style={styles.summaryMacros}>
            Protein: {totalProtein.toFixed(1)}g • Carbs: {totalCarbs.toFixed(1)}g • Fat:{' '}
            {totalFat.toFixed(1)}g
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          {entries.length} {entries.length === 1 ? 'item' : 'items'}
        </Text>

        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>{mealTypeLabel}</Text>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <EditEntryModal
        visible={!!editingEntry}
        entry={editingEntry}
        onSave={handleSaveEdit}
        onClose={handleCloseModal}
        saving={saving}
      />
    </SafeAreaView>
  );
};

export default MealTypeEntriesScreen;
