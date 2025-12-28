import { z } from 'zod';
import { SCALE_TYPES } from '../constants/scaleConstants';

// Zod validation schema for product form
export const productFormSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Product name is required')
      .max(50, 'Product name must be 50 characters or less'),
    category: z
      .string()
      .min(1, 'Category is required')
      .max(50, 'Category must be 50 characters or less'),
    portionSize: z
      .number({ message: 'Portion size must be a number' })
      .positive('Portion size must be greater than 0'),
    scaleType: z.enum(SCALE_TYPES, {
      message: 'Please select a scale type',
    }),
    scaleUnit: z.string().min(1, 'Please select a unit'),
    calories: z
      .number({ message: 'Calories must be a number' })
      .min(0, 'Calories cannot be negative'),
    includeNutrients: z.boolean(),
    fat: z.number({ message: 'Fat must be a number' }).min(0).optional(),
    carbs: z.number({ message: 'Carbs must be a number' }).min(0).optional(),
    protein: z.number({ message: 'Protein must be a number' }).min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.includeNutrients) {
        return data.fat !== undefined && data.carbs !== undefined && data.protein !== undefined;
      }
      return true;
    },
    {
      message: 'All nutrient fields are required when nutrients are enabled',
      path: ['includeNutrients'],
    },
  );

export type ProductFormData = z.infer<typeof productFormSchema>;

