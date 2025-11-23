import { useMemo } from 'react';

import { Meal } from '../models/types';

export const useMeals = () => {
  return useMemo<Meal[]>(() => [], []);
};
