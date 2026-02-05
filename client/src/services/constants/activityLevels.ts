import { ActivityLevel } from '@models/types';

export interface ActivityLevelInfo {
  value: ActivityLevel;
  label: string;
  multiplier: number;
  shortDescription: string;
  detailedDescription: string;
  examples: string[];
  icon: string;
}

/**
 * Activity level information with detailed descriptions and examples.
 * Used for BMR/TDEE calculations and user education.
 */
export const ACTIVITY_LEVELS: ActivityLevelInfo[] = [
  {
    value: 'sedentary',
    label: 'Sedentary',
    multiplier: 1.2,
    shortDescription: 'Little or no exercise',
    detailedDescription:
      "You work a desk job and don't exercise regularly. Most of your day is spent sitting — working at a computer, watching TV, or driving.",
    examples: [
      'Office worker with no gym routine',
      'Student who studies most of the day',
      'Remote worker who rarely leaves home',
    ],
    icon: '🪑',
  },
  {
    value: 'light',
    label: 'Lightly Active',
    multiplier: 1.375,
    shortDescription: 'Light exercise 1-3 days/week',
    detailedDescription:
      'You have a mostly sedentary job but do some light activity. You might take walks, do light housework, or exercise a couple times per week.',
    examples: [
      'Office worker who walks 30 min daily',
      'Light gym sessions 2-3x per week',
      'Regular yoga or stretching routine',
    ],
    icon: '🚶',
  },
  {
    value: 'moderate',
    label: 'Moderately Active',
    multiplier: 1.55,
    shortDescription: 'Moderate exercise 3-5 days/week',
    detailedDescription:
      'You exercise regularly at moderate intensity. You break a sweat and elevate your heart rate several times per week.',
    examples: [
      'Gym workouts 3-5 times per week',
      'Regular jogging, cycling, or swimming',
      'Active job like retail or teaching + some exercise',
    ],
    icon: '🏃',
  },
  {
    value: 'active',
    label: 'Very Active',
    multiplier: 1.725,
    shortDescription: 'Hard exercise 6-7 days/week',
    detailedDescription:
      "You train hard almost every day or have a physically demanding job. You're active for several hours daily.",
    examples: [
      'Daily intense workouts (CrossFit, running, etc.)',
      'Construction worker or warehouse job',
      'Competitive amateur athlete in training',
    ],
    icon: '🏋️',
  },
  {
    value: 'very_active',
    label: 'Extremely Active',
    multiplier: 1.9,
    shortDescription: 'Very intense exercise + physical job',
    detailedDescription:
      'You have an extremely active lifestyle — either training like a professional athlete or combining a physical job with regular intense exercise.',
    examples: [
      'Professional or semi-pro athlete',
      'Military training or boot camp',
      'Physical labor job + daily gym sessions',
    ],
    icon: '⚡',
  },
];

/**
 * Get activity level info by value.
 */
export const getActivityLevelInfo = (level: ActivityLevel): ActivityLevelInfo | undefined => {
  return ACTIVITY_LEVELS.find((l) => l.value === level);
};

/**
 * Activity level selection tip message.
 */
export const ACTIVITY_LEVEL_TIP =
  'Choose the level that best matches your typical week, not your most active days.';
