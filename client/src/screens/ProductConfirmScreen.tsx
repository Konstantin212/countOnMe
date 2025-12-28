import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProfileStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { Scale, SCALE_OPTIONS, toGrams } from '../services/utils/scales';
import { useTheme } from '../hooks/useTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProductConfirm'>;

const ProductConfirmScreen = ({ navigation, route }: Props) => {
  const { externalProduct } = route.params;
  const { addProduct } = useProducts();
  const { colors } = useTheme();

  const [amount, setAmount] = useState('100');
  const [selectedScale, setSelectedScale] = useState<Scale>('g');
  const [saving, setSaving] = useState(false);

  // Determine if we have nutritional data from Open Food Facts
  const hasNutritionalData = externalProduct.caloriesPer100g > 0;

  // Calculate nutritional values for the selected amount
  const calculatedValues = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !hasNutritionalData) {
      return null;
    }

    // Convert amount to grams
    const gramsAmount = toGrams(numAmount, selectedScale);
    
    // Calculate ratio to 100g
    const ratio = gramsAmount / 100;

    return {
      grams: gramsAmount,
      calories: Math.round(externalProduct.caloriesPer100g * ratio),
      protein: externalProduct.proteinPer100g 
        ? (externalProduct.proteinPer100g * ratio).toFixed(1) 
        : null,
      carbs: externalProduct.carbsPer100g 
        ? (externalProduct.carbsPer100g * ratio).toFixed(1) 
        : null,
      fat: externalProduct.fatPer100g 
        ? (externalProduct.fatPer100g * ratio).toFixed(1) 
        : null,
    };
  }, [amount, selectedScale, externalProduct, hasNutritionalData]);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    setSaving(true);
    try {
      // Calculate calories per 100g based on the entered amount and scale
      let caloriesPer100g = externalProduct.caloriesPer100g;

      // If data exists in database, it's already per 100g
      // Otherwise, user would need to enter it manually (but we have it from API)

      // Create the product
      const productName = externalProduct.brands
        ? `${externalProduct.name} (${externalProduct.brands})`
        : externalProduct.name;

      await addProduct({
        name: productName,
        caloriesPer100g,
        proteinPer100g: externalProduct.proteinPer100g,
        carbsPer100g: externalProduct.carbsPer100g,
        fatPer100g: externalProduct.fatPer100g,
      });

      Alert.alert('Success', 'Product added to your list', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to products list
            navigation.navigate('ProductsList');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save product. Please try again.');
      console.error('Save product error:', error);
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    infoCard: {
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 8,
    },
    productName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    productBrand: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    calculatedCard: {
      backgroundColor: colors.successLight,
      padding: 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.success,
    },
    nutrientCard: {
      backgroundColor: colors.infoLight,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nutrientRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    nutrientLabel: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    nutrientValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '600',
    },
    nutrientValueLarge: {
      fontSize: 24,
      color: colors.success,
      fontWeight: '700',
    },
    equivalentText: {
      fontSize: 13,
      color: colors.success,
      marginTop: 12,
      textAlign: 'center',
      fontWeight: '500',
    },
    amountContainer: {
      gap: 12,
    },
    amountInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    scaleButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    scaleButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
      alignItems: 'center',
    },
    scaleButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    scaleButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    scaleButtonTextActive: {
      color: colors.buttonText,
    },
    infoBox: {
      margin: 16,
      padding: 16,
      backgroundColor: colors.warningLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    saveButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: colors.disabled,
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Product Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.productName}>{externalProduct.name}</Text>
            {externalProduct.brands && (
              <Text style={styles.productBrand}>{externalProduct.brands}</Text>
            )}
          </View>
        </View>

        {/* Amount Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Amount</Text>
          <Text style={styles.sectionSubtitle}>
            Adjust the amount to see calculated nutritional values
          </Text>

          <View style={styles.amountContainer}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#999"
            />

            <View style={styles.scaleButtons}>
              {SCALE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.scaleButton,
                    selectedScale === option.value && styles.scaleButtonActive,
                  ]}
                  onPress={() => setSelectedScale(option.value)}
                >
                  <Text
                    style={[
                      styles.scaleButtonText,
                      selectedScale === option.value && styles.scaleButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Calculated Nutritional Values */}
        {hasNutritionalData && calculatedValues && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Nutritional Values for {amount} {selectedScale}
            </Text>
            <View style={styles.calculatedCard}>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Calories</Text>
                <Text style={styles.nutrientValueLarge}>{calculatedValues.calories} kcal</Text>
              </View>
              {calculatedValues.protein !== null && (
                <View style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel}>Protein</Text>
                  <Text style={styles.nutrientValue}>{calculatedValues.protein} g</Text>
                </View>
              )}
              {calculatedValues.carbs !== null && (
                <View style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel}>Carbohydrates</Text>
                  <Text style={styles.nutrientValue}>{calculatedValues.carbs} g</Text>
                </View>
              )}
              {calculatedValues.fat !== null && (
                <View style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel}>Fat</Text>
                  <Text style={styles.nutrientValue}>{calculatedValues.fat} g</Text>
                </View>
              )}
              <Text style={styles.equivalentText}>
                ≈ {calculatedValues.grams.toFixed(1)} g
              </Text>
            </View>
          </View>
        )}

        {/* Per 100g Reference Data */}
        {hasNutritionalData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reference Data (per 100g)</Text>
            <View style={styles.nutrientCard}>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Calories</Text>
                <Text style={styles.nutrientValue}>
                  {Math.round(externalProduct.caloriesPer100g)} kcal
                </Text>
              </View>
              {externalProduct.proteinPer100g !== undefined && (
                <View style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel}>Protein</Text>
                  <Text style={styles.nutrientValue}>
                    {externalProduct.proteinPer100g.toFixed(1)} g
                  </Text>
                </View>
              )}
              {externalProduct.carbsPer100g !== undefined && (
                <View style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel}>Carbohydrates</Text>
                  <Text style={styles.nutrientValue}>
                    {externalProduct.carbsPer100g.toFixed(1)} g
                  </Text>
                </View>
              )}
              {externalProduct.fatPer100g !== undefined && (
                <View style={styles.nutrientRow}>
                  <Text style={styles.nutrientLabel}>Fat</Text>
                  <Text style={styles.nutrientValue}>{externalProduct.fatPer100g.toFixed(1)} g</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Info Note */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 The product will be saved with reference values per 100g. When building meals, you
            can specify any amount you want!
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Product'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default ProductConfirmScreen;

