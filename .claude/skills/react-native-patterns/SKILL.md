---
name: react-native-patterns
description: React Native, Expo, and TypeScript patterns for building performant, accessible, and maintainable mobile components, hooks, screens, and navigation in CountOnMe.
---

# React Native Development Patterns

Patterns and best practices for CountOnMe's Expo + React Native + TypeScript client.

## When to Activate

- Writing or reviewing React Native components, screens, or hooks
- Implementing navigation flows
- Building forms with React Hook Form + Zod
- Styling components with theme system
- Testing with Vitest + React Testing Library
- Working with AsyncStorage or device identity

## Tech Stack

- **Framework**: Expo 54 / React Native 0.81
- **Language**: TypeScript 5.9 (strict mode)
- **Navigation**: React Navigation (bottom tabs, native stack)
- **Forms**: React Hook Form + Zod validation
- **UI Primitives**: Particle system (FormField, Input, Button, etc.)
- **Storage**: AsyncStorage (offline-first)
- **Testing**: Vitest + React Testing Library
- **Theming**: ThemeContext with LightTheme/DarkTheme

## Component Patterns

### Functional Components with Typed Props

```typescript
// ✅ GOOD: Typed props, destructured, default values
interface ProductCardProps {
  product: Product
  onPress: (id: string) => void
  showCalories?: boolean
}

export function ProductCard({
  product,
  onPress,
  showCalories = true,
}: ProductCardProps) {
  const { colors } = useTheme()

  return (
    <Pressable
      testID="product-card"
      style={[styles.container, { backgroundColor: colors.surface }]}
      onPress={() => onPress(product.id)}
    >
      <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
      {showCalories && (
        <Text style={[styles.calories, { color: colors.textSecondary }]}>
          {product.caloriesPer100g} kcal/100g
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  calories: { fontSize: 14, marginTop: 4 },
})

// ❌ BAD: Untyped props, inline styles, hardcoded colors
export function ProductCard(props) {
  return (
    <View style={{ padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ color: '#333' }}>{props.product.name}</Text>
    </View>
  )
}
```

### Screen Components (Organisms)

```typescript
// ✅ GOOD: Screen consumes hook, handles states, uses particles
export function ProductsListScreen() {
  const { products, isLoading, error, searchProducts } = useProducts()
  const navigation = useNavigation<ProductsStackNavigation>()

  if (isLoading) return <ActivityIndicator />
  if (error) return <ErrorMessage message={error} />

  return (
    <View style={styles.container}>
      <Input
        placeholder="Search products..."
        onChangeText={searchProducts}
        testID="search-input"
      />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={(id) => navigation.navigate('ProductForm', { productId: id })}
          />
        )}
        ListEmptyComponent={<EmptyState message="No products yet" />}
      />
    </View>
  )
}

// ❌ BAD: Screen owns state, talks to AsyncStorage, uses ScrollView+map
export function ProductsListScreen() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    AsyncStorage.getItem('products').then(data => setProducts(JSON.parse(data)))
  }, [])
  return (
    <ScrollView>
      {products.map((p, i) => <Text key={i}>{p.name}</Text>)}
    </ScrollView>
  )
}
```

## Hook Patterns

### Custom Hooks Own State

```typescript
// ✅ GOOD: Hook owns state, returns action-oriented methods
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const stored = await loadProductsFromStorage()
      setProducts(stored)
    } catch (e) {
      setError('Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addProduct = useCallback(async (data: ProductInput) => {
    const newProduct: Product = { id: generateId(), ...data, createdAt: new Date() }
    // Immutable update
    setProducts(prev => [...prev, newProduct])
    await saveProductsToStorage([...products, newProduct])
  }, [products])

  const deleteProduct = useCallback(async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
    await removeProductFromStorage(id)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  return { products, isLoading, error, addProduct, deleteProduct, loadProducts }
}

// ❌ BAD: Exposes raw setters, no error handling
export function useProducts() {
  const [products, setProducts] = useState([])
  return { products, setProducts } // Never expose raw setters!
}
```

### Hook Return Object Pattern

```typescript
// ✅ Return objects with descriptive method names
return {
  // Data
  products,
  isLoading,
  error,
  // Actions (verb-based)
  addProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  refreshProducts,
}
```

## Navigation Patterns

### Typed Navigation Params

```typescript
// ✅ GOOD: Typed param lists
export type ProductsStackParamList = {
  ProductsList: undefined
  ProductForm: { productId?: string }
  ProductDetails: { productId: string }
}

export type MealsStackParamList = {
  MealsList: undefined
  MealBuilder: { mealId?: string }
  MealDetails: { mealId: string }
  SelectProduct: { mealTypeId: string }
}

// Usage in screen
type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductForm'>

export function ProductFormScreen({ route, navigation }: Props) {
  const { productId } = route.params ?? {}
  const isEditing = !!productId
  // ...
}
```

## Form Patterns

### React Hook Form + Zod + Particles

```typescript
// ✅ GOOD: Schema validation + particle components
const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  caloriesPer100g: z.number().min(0).max(10000),
})

type FormData = z.infer<typeof schema>

export function ProductFormScreen() {
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', caloriesPer100g: 0 },
  })

  const onSubmit = (data: FormData) => {
    addProduct(data)
    navigation.goBack()
  }

  return (
    <View style={styles.container}>
      <FormField label="Product Name" error={errors.name?.message}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <Input value={value} onChangeText={onChange} testID="name-input" />
          )}
        />
      </FormField>
      <FormField label="Calories per 100g" error={errors.caloriesPer100g?.message}>
        <Controller
          control={control}
          name="caloriesPer100g"
          render={({ field: { onChange, value } }) => (
            <NumericInput value={value} onChangeValue={onChange} testID="calories-input" />
          )}
        />
      </FormField>
      <Button title="Save" onPress={handleSubmit(onSubmit)} testID="save-button" />
    </View>
  )
}
```

## Styling Patterns

### Theme-Aware Styles

```typescript
// ✅ GOOD: StyleSheet.create + theme from context
export function MyComponent() {
  const { colors } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Title</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Subtitle</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
})

// ❌ BAD: Inline styles, hardcoded colors
<View style={{ flex: 1, padding: 16, backgroundColor: '#ffffff' }}>
  <Text style={{ color: '#333333', fontSize: 20 }}>Title</Text>
</View>
```

## Performance Patterns

### FlatList for Lists (Never ScrollView+map)

```typescript
// ✅ GOOD: FlatList with keyExtractor
<FlatList
  data={products}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ProductCard product={item} onPress={handlePress} />}
  ListEmptyComponent={<EmptyState />}
  initialNumToRender={10}
/>

// ❌ BAD: ScrollView + map (no virtualization)
<ScrollView>
  {products.map((p, i) => <ProductCard key={i} product={p} />)}
</ScrollView>
```

### Memoization (Only When Needed)

```typescript
// ✅ Use only when computation is expensive or prevents re-renders
const sortedProducts = useMemo(
  () => products.sort((a, b) => a.name.localeCompare(b.name)),
  [products]
)

const handlePress = useCallback(
  (id: string) => navigation.navigate('ProductDetails', { productId: id }),
  [navigation]
)
```

## State Management Patterns

### Immutable Updates (CRITICAL)

```typescript
// ✅ ALWAYS create new objects
setProducts(prev => [...prev, newProduct])
setProducts(prev => prev.filter(p => p.id !== id))
setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))

// ❌ NEVER mutate
products.push(newProduct)
products[index].name = 'New Name'
products.splice(index, 1)
```

### Derived State (Never Store What You Can Calculate)

```typescript
// ✅ GOOD: Calculate on the fly
const totalCalories = useMemo(
  () => calcMealCalories(mealItems, products),
  [mealItems, products]
)

// ❌ BAD: Storing derived data in state
const [totalCalories, setTotalCalories] = useState(0)
// Now you must keep it in sync manually!
```

## Import Alias Patterns

```typescript
// ✅ GOOD: Use configured aliases for cross-folder imports
import { useProducts } from '@hooks/useProducts'
import { Product } from '@models/types'
import { calculateCalories } from '@services/utils/calories'
import { Button, FormField } from '../particles' // relative OK within same folder

// ❌ BAD: Deep relative paths
import { useProducts } from '../../hooks/useProducts'
import { Product } from '../../../models/types'
```

## Testing Patterns

### Component Testing

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react-native'

describe('ProductCard', () => {
  const mockProduct = { id: '1', name: 'Chicken', caloriesPer100g: 165 }

  it('displays product name and calories', () => {
    render(<ProductCard product={mockProduct} onPress={vi.fn()} />)
    expect(screen.getByText('Chicken')).toBeTruthy()
    expect(screen.getByText('165 kcal/100g')).toBeTruthy()
  })

  it('calls onPress with product id', () => {
    const onPress = vi.fn()
    render(<ProductCard product={mockProduct} onPress={onPress} />)
    fireEvent.press(screen.getByTestId('product-card'))
    expect(onPress).toHaveBeenCalledWith('1')
  })
})
```

### Hook Testing

```typescript
import { renderHook, waitFor, act } from '@testing-library/react-native'

describe('useProducts', () => {
  it('loads products on mount', async () => {
    vi.mocked(loadProductsFromStorage).mockResolvedValue([mockProduct])
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.products).toEqual([mockProduct])
  })
})
```

## Particle System (Atomic Components)

All form UI MUST use particles from `client/src/particles/`:
- `FormField` — Label + input + error wrapper
- `Input` — Text input with theme styling
- `NumericInput` — Number-only input
- `Button` — Themed pressable button
- `RadioGroup` — Radio selection
- `SwitchField` — Toggle switch
- `Typography` (Label, ErrorText, SectionTitle, Subtitle)

Import from barrel: `import { FormField, Input, Button } from '../particles'`

## Anti-Patterns to Avoid

| Anti-Pattern | Fix |
|-------------|-----|
| `any` type | Use specific type or `unknown` |
| `!` non-null assertion | Use optional chaining `?.` |
| `@ts-ignore` | Use `@ts-expect-error` with explanation |
| Inline styles | `StyleSheet.create` |
| Hardcoded colors | `useTheme().colors` |
| `ScrollView` + `.map()` | `FlatList` with `keyExtractor` |
| Raw state setters from hooks | Action-oriented methods |
| `console.log` in production | Remove before commit |
| Screens touching AsyncStorage | Hooks own storage access |
| Mutating state directly | Spread operator / functional updates |

---

**Remember**: React Native components should be small, focused, theme-aware, and tested. Hooks own state. Screens compose hooks and particles. Never mutate. Always type.
