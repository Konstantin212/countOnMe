import React, { useEffect, useState } from 'react';
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

import { ProductsStackParamList } from '../app/navigationTypes';
import { useProducts } from '../hooks/useProducts';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductForm'>;

const ProductFormScreen = ({ navigation, route }: Props) => {
  const isEditing = Boolean(route.params?.productId);
  const { products, addProduct, updateProduct } = useProducts();

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  // Load product data if editing
  useEffect(() => {
    if (isEditing && route.params?.productId) {
      const product = products.find((p) => p.id === route.params.productId);
      if (product) {
        setName(product.name);
        setCalories(String(product.caloriesPer100g));
        setProtein(product.proteinPer100g ? String(product.proteinPer100g) : '');
        setCarbs(product.carbsPer100g ? String(product.carbsPer100g) : '');
        setFat(product.fatPer100g ? String(product.fatPer100g) : '');
      }
    }
  }, [isEditing, route.params?.productId, products]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }

    const caloriesNum = parseFloat(calories);
    if (!caloriesNum || caloriesNum < 0) {
      Alert.alert('Error', 'Please enter valid calories (must be 0 or greater)');
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name: name.trim(),
        caloriesPer100g: caloriesNum,
        proteinPer100g: protein ? parseFloat(protein) : undefined,
        carbsPer100g: carbs ? parseFloat(carbs) : undefined,
        fatPer100g: fat ? parseFloat(fat) : undefined,
      };

      if (isEditing && route.params?.productId) {
        await updateProduct(route.params.productId, productData);
        Alert.alert('Success', 'Product updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        await addProduct(productData);
        Alert.alert('Success', 'Product added successfully', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ProductsList'),
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save product. Please try again.');
      console.error('Save product error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Product Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Product Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Chicken Breast, Brown Rice"
            placeholderTextColor="#999"
          />
        </View>

        {/* Calories */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Calories (per 100g) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            placeholder="e.g., 165"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Macros Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Macronutrients (per 100g)</Text>
          <Text style={styles.sectionSubtitle}>Optional - add if you have the data</Text>

          <View style={styles.macroRow}>
            <View style={styles.macroField}>
              <Text style={styles.label}>Protein (g)</Text>
              <TextInput
                style={styles.input}
                value={protein}
                onChangeText={setProtein}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.macroField}>
              <Text style={styles.label}>Carbs (g)</Text>
              <TextInput
                style={styles.input}
                value={carbs}
                onChangeText={setCarbs}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.macroField}>
            <Text style={styles.label}>Fat (g)</Text>
            <TextInput
              style={styles.input}
              value={fat}
              onChangeText={setFat}
              placeholder="0"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 All values should be per 100g of the product. You can specify any amount when
            building meals.
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
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : isEditing ? 'Update Product' : 'Save Product'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default ProductFormScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  macroField: {
    flex: 1,
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
