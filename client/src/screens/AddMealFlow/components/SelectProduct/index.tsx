import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SegmentedButtons } from 'react-native-paper';

import { useTheme } from '@hooks/useTheme';
import { useProducts } from '@hooks/useProducts';
import type { Product } from '@models/types';
import { MyDayStackParamList } from '@app/navigationTypes';
import { loadProductFavourites, loadProductRecents, saveProductFavourites } from '@storage/storage';

type Props = NativeStackScreenProps<MyDayStackParamList, 'SelectProduct'>;

type Mode = 'all' | 'favourites';

const SelectProductScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { products } = useProducts();
  const [mode, setMode] = useState<Mode>('all');
  const [query, setQuery] = useState('');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [recents, setRecents] = useState<string[]>([]);

  React.useEffect(() => {
    (async () => {
      const [fav, recent] = await Promise.all([loadProductFavourites(), loadProductRecents()]);
      setFavourites(new Set(fav));
      setRecents(recent);
    })();
  }, []);

  const toggleFavourite = useCallback(
    async (productId: string) => {
      setFavourites((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        void saveProductFavourites(Array.from(next));
        return next;
      });
    },
    [],
  );

  const recentProducts = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return recents.map((id) => map.get(id)).filter(Boolean) as Product[];
  }, [products, recents]);

  const quickAccess = useMemo(() => recentProducts.slice(0, 4), [recentProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = mode === 'favourites' ? products.filter((p) => favourites.has(p.id)) : products;

    if (!q) {
      // Default: show recents (if any), then rest alphabetical
      const recentSet = new Set(recents);
      const recentOrdered = base
        .filter((p) => recentSet.has(p.id))
        .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
      const rest = base
        .filter((p) => !recentSet.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      return [...recentOrdered, ...rest];
    }

    const matches = base.filter((p) => p.name.toLowerCase().includes(q));
    const recentSet = new Set(recents);
    const recentMatches = matches
      .filter((p) => recentSet.has(p.id))
      .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
    const otherMatches = matches
      .filter((p) => !recentSet.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...recentMatches, ...otherMatches];
  }, [favourites, mode, products, query, recents]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
      gap: 12,
    },
    backButton: { padding: 8, borderRadius: 999, backgroundColor: colors.cardBackground },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
    controls: { paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    quickRow: { flexDirection: 'row', gap: 12 },
    quickCard: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    quickName: { color: colors.text, fontWeight: '700' },
    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    row: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowName: { flex: 1, color: colors.text, fontWeight: '600' },
    rowMeta: { color: colors.textSecondary, fontSize: 12 },
    star: { padding: 6 },
  });

  const renderRow = ({ item }: { item: Product }) => (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        navigation.navigate('AddFood', { productId: item.id });
      }}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.caloriesPer100g} kcal / 100g</Text>
      </View>
      <Pressable style={styles.star} onPress={() => toggleFavourite(item.id)} hitSlop={8}>
        <Ionicons
          name={favourites.has(item.id) ? 'star' : 'star-outline'}
          size={20}
          color={favourites.has(item.id) ? colors.warning : colors.textSecondary}
        />
      </Pressable>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Select product</Text>
      </View>

      <View style={styles.controls}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'favourites', label: 'Favourite' },
          ]}
        />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products..."
          placeholderTextColor={colors.textTertiary}
          style={styles.search}
        />

        {quickAccess.length > 0 ? (
          <View>
            <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>
              Quick access
            </Text>
            <View style={styles.quickRow}>
              {quickAccess.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.quickCard}
                  onPress={() => navigation.navigate('AddFood', { productId: p.id })}
                >
                  <Text style={styles.quickName} numberOfLines={2}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

export default SelectProductScreen;

