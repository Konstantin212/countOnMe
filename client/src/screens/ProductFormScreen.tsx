import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ProfileStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { useTheme } from '../hooks/useTheme';
import { productFormSchema, ProductFormData } from '../services/schemas/productFormSchema';
import { SCALE_TYPES, SCALE_UNITS } from '../services/constants/scaleConstants';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProductForm'>;

const ProductFormScreen = ({ navigation, route }: Props) => {
  const isEditing = Boolean(route.params?.productId);
  const { products, addProduct, updateProduct } = useProducts();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      category: '',
      portionSize: undefined,
      scaleType: 'Solid',
      scaleUnit: 'g',
      calories: undefined,
      includeNutrients: false,
      fat: undefined,
      carbs: undefined,
      protein: undefined,
    },
  });

  const scaleType = watch('scaleType');
  const includeNutrients = watch('includeNutrients');

  // Load product data if editing
  useEffect(() => {
    if (isEditing && route.params?.productId) {
      const product = products.find((p) => p.id === route.params?.productId);
      if (product) {
        setValue('name', product.name);
        setValue('calories', product.caloriesPer100g);
        
        const hasNutrients = Boolean(
          product.proteinPer100g || product.carbsPer100g || product.fatPer100g
        );
        
        if (hasNutrients) {
          setValue('includeNutrients', true);
          setValue('protein', product.proteinPer100g);
          setValue('carbs', product.carbsPer100g);
          setValue('fat', product.fatPer100g);
        }
      }
    }
  }, [isEditing, route.params?.productId, products, setValue]);

  // Reset scale unit when scale type changes
  useEffect(() => {
    if (scaleType) {
      const availableUnits = SCALE_UNITS[scaleType];
      setValue('scaleUnit', availableUnits[0]);
    }
  }, [scaleType, setValue]);

  const onSubmit = async (data: ProductFormData) => {
    setSaving(true);
    try {
      const productData = {
        name: data.name.trim(),
        caloriesPer100g: data.calories,
        proteinPer100g: data.includeNutrients ? data.protein : undefined,
        carbsPer100g: data.includeNutrients ? data.carbs : undefined,
        fatPer100g: data.includeNutrients ? data.fat : undefined,
      };

      if (isEditing && route.params?.productId) {
        await updateProduct(route.params.productId, productData);
        navigation.goBack();
      } else {
        await addProduct(productData);
        navigation.navigate('ProductsList');
      }
    } catch (error) {
      console.error('Save product error:', error);
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = Object.keys(errors).length === 0;
  const isSaveDisabled = saving || (isSubmitted && !isFormValid);

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
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    required: {
      color: colors.error,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    inputError: {
      borderColor: colors.error,
      borderWidth: 2,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      marginTop: 4,
    },
    radioGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    radioButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    radioButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    radioButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    radioButtonTextActive: {
      color: colors.primary,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    switchLabel: {
      flex: 1,
    },
    nutrientField: {
      marginBottom: 16,
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
        {/* Product Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Product Name <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g., Chicken Breast"
                  placeholderTextColor="#999"
                  maxLength={50}
                />
                {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}
              </>
            )}
          />
        </View>

        {/* Product Category */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Product Category <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <TextInput
                  style={[styles.input, errors.category && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g., Meat, Vegetables"
                  placeholderTextColor="#999"
                  maxLength={50}
                />
                {errors.category && <Text style={styles.errorText}>{errors.category.message}</Text>}
              </>
            )}
          />
        </View>

        {/* Portion Size */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Portion Size <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="portionSize"
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <TextInput
                  style={[styles.input, errors.portionSize && styles.inputError]}
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    onChange(isNaN(num) ? undefined : num);
                  }}
                  onBlur={onBlur}
                  placeholder="e.g., 100"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                {errors.portionSize && (
                  <Text style={styles.errorText}>{errors.portionSize.message}</Text>
                )}
              </>
            )}
          />
        </View>

        {/* Scale Type */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Scale Type <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="scaleType"
            render={({ field: { onChange, value } }) => (
              <View style={styles.radioGroup}>
                {SCALE_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.radioButton, value === type && styles.radioButtonActive]}
                    onPress={() => onChange(type)}
                  >
                    <Text
                      style={[styles.radioButtonText, value === type && styles.radioButtonTextActive]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          {errors.scaleType && <Text style={styles.errorText}>{errors.scaleType.message}</Text>}
        </View>

        {/* Scale Unit */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Unit <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="scaleUnit"
            render={({ field: { onChange, value } }) => (
              <View style={styles.radioGroup}>
                {SCALE_UNITS[scaleType].map((unit) => (
                  <Pressable
                    key={unit}
                    style={[styles.radioButton, value === unit && styles.radioButtonActive]}
                    onPress={() => onChange(unit)}
                  >
                    <Text
                      style={[styles.radioButtonText, value === unit && styles.radioButtonTextActive]}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          {errors.scaleUnit && <Text style={styles.errorText}>{errors.scaleUnit.message}</Text>}
        </View>

        {/* Calories */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Calories <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="calories"
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <TextInput
                  style={[styles.input, errors.calories && styles.inputError]}
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    onChange(isNaN(num) ? undefined : num);
                  }}
                  onBlur={onBlur}
                  placeholder="e.g., 165"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                {errors.calories && <Text style={styles.errorText}>{errors.calories.message}</Text>}
              </>
            )}
          />
        </View>

        {/* Nutrients Toggle */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Include Nutrients</Text>
              <Text style={styles.sectionSubtitle}>Add fat, carbs, and protein information</Text>
            </View>
            <Controller
              control={control}
              name="includeNutrients"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                  thumbColor={value ? '#2563eb' : '#f4f3f4'}
                />
              )}
            />
          </View>
          {errors.includeNutrients && (
            <Text style={styles.errorText}>{errors.includeNutrients.message}</Text>
          )}
        </View>

        {/* Nutrients Section */}
        {includeNutrients && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Macronutrients</Text>

            {/* Fat */}
            <View style={styles.nutrientField}>
              <Text style={styles.label}>
                Fat (g) <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                name="fat"
                render={({ field: { onChange, onBlur, value } }) => (
                  <>
                    <TextInput
                      style={[styles.input, errors.fat && styles.inputError]}
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(text) => {
                        const num = parseFloat(text);
                        onChange(isNaN(num) ? undefined : num);
                      }}
                      onBlur={onBlur}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    {errors.fat && <Text style={styles.errorText}>{errors.fat.message}</Text>}
                  </>
                )}
              />
            </View>

            {/* Carbs */}
            <View style={styles.nutrientField}>
              <Text style={styles.label}>
                Carbs (g) <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                name="carbs"
                render={({ field: { onChange, onBlur, value } }) => (
                  <>
                    <TextInput
                      style={[styles.input, errors.carbs && styles.inputError]}
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(text) => {
                        const num = parseFloat(text);
                        onChange(isNaN(num) ? undefined : num);
                      }}
                      onBlur={onBlur}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    {errors.carbs && <Text style={styles.errorText}>{errors.carbs.message}</Text>}
                  </>
                )}
              />
            </View>

            {/* Protein */}
            <View style={styles.nutrientField}>
              <Text style={styles.label}>
                Protein (g) <Text style={styles.required}>*</Text>
              </Text>
              <Controller
                control={control}
                name="protein"
                render={({ field: { onChange, onBlur, value } }) => (
                  <>
                    <TextInput
                      style={[styles.input, errors.protein && styles.inputError]}
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(text) => {
                        const num = parseFloat(text);
                        onChange(isNaN(num) ? undefined : num);
                      }}
                      onBlur={onBlur}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    {errors.protein && (
                      <Text style={styles.errorText}>{errors.protein.message}</Text>
                    )}
                  </>
                )}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSaveDisabled}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : isEditing ? 'Update Product' : 'Save Product'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default ProductFormScreen;
