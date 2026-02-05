import { apiFetch } from './http';
import type { MealType } from './foodEntries';

export type MacroTotals = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

export type DayStatsResponse = {
  day: string; // YYYY-MM-DD
  totals: MacroTotals;
  by_meal_type: Partial<Record<MealType, MacroTotals>>;
};

export type DailyStatsPoint = {
  day: string;
  totals: MacroTotals;
};

export type DailyStatsResponse = {
  from_day: string;
  to_day: string;
  points: DailyStatsPoint[];
};

export type WeightPoint = {
  day: string;
  weight_kg: string;
};

export type WeightStatsResponse = {
  from_day: string;
  to_day: string;
  points: WeightPoint[];
};

export const getDayStats = async (day: string): Promise<DayStatsResponse> => {
  return await apiFetch<DayStatsResponse>(`/v1/stats/day/${day}`);
};

export const getDailyStats = async (from: string, to: string): Promise<DailyStatsResponse> => {
  return await apiFetch<DailyStatsResponse>('/v1/stats/daily', { query: { from, to } });
};

export const getWeightStats = async (from: string, to: string): Promise<WeightStatsResponse> => {
  return await apiFetch<WeightStatsResponse>('/v1/stats/weight', { query: { from, to } });
};

