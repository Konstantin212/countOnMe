import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductForm'>;

const inputAccessoryLabel = {
  name: 'Product name',
  calories: 'Calories per 100g',
};

const ProductFormScreen = ({ navigation, route }: Props) => {
  const productId = route.params?.productId;
  const isEditing = Boolean(productId);
  const { products, addProduct, updateProduct, loading } = useProducts();

  const product = useMemo(
    () => products.find((candidate) => candidate.id === productId) ?? null,
    [products, productId],
  );

  const [name, setName] = useState(product?.name ?? '');
  const [calories, setCalories] = useState(product ? String(product.caloriesPer100g) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product && isEditing) {
      setName(product.name);
      setCalories(String(product.caloriesPer100g));
    }
  }, [product, isEditing]);

  const handleValidation = (): { name: string; caloriesPer100g: number } | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return null;
    }

    const caloriesValue = Number(calories);
    if (Number.isNaN(caloriesValue) || caloriesValue < 0) {
      setError('Calories must be a number greater than or equal to 0.');
      return null;
    }

    setError(null);
    return { name: trimmedName, caloriesPer100g: caloriesValue };
  };

  const handleSave = useCallback(async () => {
    const validated = handleValidation();
    if (!validated) {
      return;
    }

    setSaving(true);
    try {
      if (isEditing && productId) {
        await updateProduct(productId, validated);
      } else {
        await addProduct(validated);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', 'Could not save the product. Please try again.');
      console.error('Failed to save product', err);
    } finally {
      setSaving(false);
    }
  }, [addProduct, handleValidation, isEditing, name, navigation, productId, updateProduct]);

  const renderContent = () => {
    if (isEditing && !loading && !product) {
      return (
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Product not found</Text>
          <Text style={styles.notFoundBody}>
            This product may have been deleted. Return to the list and try again.
          </Text>
          <Button title="Go back" onPress={() => navigation.goBack()} />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{inputAccessoryLabel.name}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Chicken breast"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="next"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{inputAccessoryLabel.calories}</Text>
          <TextInput
            value={calories}
            onChangeText={setCalories}
            placeholder="165"
            keyboardType="numeric"
            style={styles.input}
            returnKeyType="done"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.container}
      >
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>{isEditing ? 'Edit product' : 'Add product'}</Text>
          <Text style={styles.subtitle}>
            Track calories per 100g so meals can stay accurate.
          </Text>
        </View>

        {renderContent()}

        <View style={styles.footer}>
          <Button
            title={isEditing ? 'Save changes' : 'Save product'}
            onPress={handleSave}
            disabled={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProductFormScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headingContainer: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
  },
  formContent: {
    paddingVertical: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  errorText: {
    marginTop: 8,
    color: '#b91c1c',
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 16,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  notFoundBody: {
    textAlign: 'center',
    color: '#555',
    marginBottom: 16,
  },
});
