import { useMemo } from 'react';

import { Product } from '../models/types';

export const useProducts = () => {
  return useMemo<Product[]>(() => [], []);
};
