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
import { Scale, SCALE_OPTIONS, toGrams } from '../utils/scales';
import { useTheme } from '../hooks/useTheme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProductDetails'>;

const ProductDetailsScreen = ({ navigation, route }: Props) => {
  const { products, deleteProduct } = useProducts();
  const { colors } = useTheme();
  const product = useMemo(() => {
    return products.find((p) => p.id === route.params.productId);
  }, [products, route.params.productId]);

  const [amount, setAmount] = useState('100');
  const [selectedScale, setSelectedScale] = useState<Scale>('g');

  // Calculate nutritional values for the selected amount
  const calculatedValues = useMemo(() => {
    if (!product) return null;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      return null;
    }

    // Convert amount to grams
    const gramsAmount = toGrams(numAmount, selectedScale);

    // Calculate ratio to 100g
    const ratio = gramsAmount / 100;

    return {
      grams: gramsAmount,
      calories: Math.round(product.caloriesPer100g * ratio),
      protein: product.proteinPer100g ? (product.proteinPer100g * ratio).toFixed(1) : null,
      carbs: product.carbsPer100g ? (product.carbsPer100g * ratio).toFixed(1) : null,
      fat: product.fatPer100g ? (product.fatPer100g * ratio).toFixed(1) : null,
    };
  }, [amount, selectedScale, product]);

  const handleDelete = () => {
    if (!product) return;

    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting product:', product.id);
              const wasDeleted = await deleteProduct(product.id);
              console.log('Product deleted successfully:', wasDeleted);
              
              if (wasDeleted) {
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Product not found');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete product. Please try again.');
            }
          },
        },
      ],
    );
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
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    productDate: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
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
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    editButton: {
      backgroundColor: colors.primary,
    },
    editButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: colors.cardBackground,
      borderWidth: 2,
      borderColor: colors.error,
    },
    deleteButtonText: {
      color: colors.error,
      fontSize: 16,
      fontWeight: '600',
    },
    notFoundContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    notFoundText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    notFoundSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    backButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    backButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Product not found</Text>
          <Text style={styles.notFoundSubtext}>This product may have been deleted.</Text>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Product Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productDate}>
              Added {new Date(product.createdAt).toLocaleDateString()}
            </Text>
            {product.updatedAt !== product.createdAt && (
              <Text style={styles.productDate}>
                Updated {new Date(product.updatedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        {/* Amount Calculator */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calculate Nutritional Values</Text>
          <Text style={styles.sectionSubtitle}>
            Adjust the amount to see calculated values
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

        {/* Calculated Values */}
        {calculatedValues && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              For {amount} {selectedScale}
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

        {/* Reference Data per 100g */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reference Values (per 100g)</Text>
          <View style={styles.nutrientCard}>
            <View style={styles.nutrientRow}>
              <Text style={styles.nutrientLabel}>Calories</Text>
              <Text style={styles.nutrientValue}>{Math.round(product.caloriesPer100g)} kcal</Text>
            </View>
            {product.proteinPer100g !== undefined && (
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Protein</Text>
                <Text style={styles.nutrientValue}>{product.proteinPer100g.toFixed(1)} g</Text>
              </View>
            )}
            {product.carbsPer100g !== undefined && (
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Carbohydrates</Text>
                <Text style={styles.nutrientValue}>{product.carbsPer100g.toFixed(1)} g</Text>
              </View>
            )}
            {product.fatPer100g !== undefined && (
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Fat</Text>
                <Text style={styles.nutrientValue}>{product.fatPer100g.toFixed(1)} g</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.editButton]}
            onPress={() => navigation.navigate('ProductForm', { productId: product.id })}
          >
            <Text style={styles.editButtonText}>Edit Product</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ProductDetailsScreen;

