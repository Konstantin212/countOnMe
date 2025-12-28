import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ProfileStackParamList } from '@app/navigationTypes';
import { useProducts } from '@hooks/useProducts';
import { useTheme } from '@hooks/useTheme';
import { productFormSchema, ProductFormData } from '@services/schemas/productFormSchema';
import { SCALE_TYPES, SCALE_UNITS } from '@services/constants/scaleConstants';
import {
  FormField,
  Input,
  NumericInput,
  RadioGroup,
  SwitchField,
  Button,
  SectionTitle,
} from '@particles/index';

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
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: colors.cardBackground,
      marginRight: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    scrollView: {
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
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Product</Text>
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Product Name */}
        <FormField>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Product Name"
                required
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g., Chicken Breast"
                maxLength={50}
                error={errors.name?.message}
              />
            )}
          />
        </FormField>

        {/* Product Category */}
        <FormField>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Product Category"
                required
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g., Meat, Vegetables"
                maxLength={50}
                error={errors.category?.message}
              />
            )}
          />
        </FormField>

        {/* Portion Size */}
        <FormField>
          <Controller
            control={control}
            name="portionSize"
            render={({ field: { onChange, value } }) => (
              <NumericInput
                label="Portion Size"
                required
                value={value}
                onChangeValue={onChange}
                placeholder="e.g., 100"
                error={errors.portionSize?.message}
              />
            )}
          />
        </FormField>

        {/* Scale Type */}
        <FormField>
          <Controller
            control={control}
            name="scaleType"
            render={({ field: { onChange, value } }) => (
              <RadioGroup
                label="Scale Type"
                required
                options={SCALE_TYPES}
                value={value}
                onChange={onChange}
                error={errors.scaleType?.message}
              />
            )}
          />
        </FormField>

        {/* Scale Unit */}
        <FormField>
          <Controller
            control={control}
            name="scaleUnit"
            render={({ field: { onChange, value } }) => (
              <RadioGroup
                label="Unit"
                required
                options={SCALE_UNITS[scaleType]}
                value={value}
                onChange={onChange}
                error={errors.scaleUnit?.message}
              />
            )}
          />
        </FormField>

        {/* Calories */}
        <FormField>
          <Controller
            control={control}
            name="calories"
            render={({ field: { onChange, value } }) => (
              <NumericInput
                label="Calories"
                required
                value={value}
                onChangeValue={onChange}
                placeholder="e.g., 165"
                error={errors.calories?.message}
              />
            )}
          />
        </FormField>

        {/* Nutrients Toggle */}
        <FormField>
          <Controller
            control={control}
            name="includeNutrients"
            render={({ field: { onChange, value } }) => (
              <SwitchField
                label="Include Nutrients"
                subtitle="Add fat, carbs, and protein information"
                value={value}
                onValueChange={onChange}
                error={errors.includeNutrients?.message}
              />
            )}
          />
        </FormField>

        {/* Nutrients Section */}
        {includeNutrients && (
          <FormField>
            <SectionTitle>Macronutrients</SectionTitle>

            {/* Fat */}
            <View style={styles.nutrientField}>
              <Controller
                control={control}
                name="fat"
                render={({ field: { onChange, value } }) => (
                  <NumericInput
                    label="Fat (g)"
                    required
                    value={value}
                    onChangeValue={onChange}
                    placeholder="0"
                    error={errors.fat?.message}
                  />
                )}
              />
            </View>

            {/* Carbs */}
            <View style={styles.nutrientField}>
              <Controller
                control={control}
                name="carbs"
                render={({ field: { onChange, value } }) => (
                  <NumericInput
                    label="Carbs (g)"
                    required
                    value={value}
                    onChangeValue={onChange}
                    placeholder="0"
                    error={errors.carbs?.message}
                  />
                )}
              />
            </View>

            {/* Protein */}
            <View style={styles.nutrientField}>
              <Controller
                control={control}
                name="protein"
                render={({ field: { onChange, value } }) => (
                  <NumericInput
                    label="Protein (g)"
                    required
                    value={value}
                    onChangeValue={onChange}
                    placeholder="0"
                    error={errors.protein?.message}
                  />
                )}
              />
            </View>
          </FormField>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button onPress={handleSubmit(onSubmit)} disabled={isSaveDisabled} loading={saving}>
          {isEditing ? 'Update Product' : 'Save Product'}
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default ProductFormScreen;
