export type Product = {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinsPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
  createdAt: string;
  updatedAt: string;
};

export type MealItem = {
  productId: string;
  grams: number;
};

export type Meal = {
  id: string;
  name: string;
  items: MealItem[];
  totalCalories: number;
  createdAt: string;
  updatedAt: string;
};
