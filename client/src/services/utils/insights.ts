import type {
  BodyWeightEntry,
  ConsistencyDay,
  ConsistencyResult,
  ConsistencyWeek,
  DailyStatsPoint,
  EfficiencyResult,
  EtaProjection,
  GoalPace,
  MacroAdherence,
  StatsPeriod,
  StreakInfo,
  UserGoal,
  WeightChangePace,
  WeightGoalType,
  WeightTrend,
} from "@models/types";

/**
 * Compute start/end date strings (YYYY-MM-DD) for a given period.
 * @param period - Time period ('7d', '30d', '90d')
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns Object with 'from' and 'to' date strings
 */
export function getDateRange(
  period: StatsPeriod,
  today?: string,
): { from: string; to: string } {
  const todayDate = today ? new Date(today) : new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  const fromDate = new Date(todayDate);
  // For "last N days", subtract N-1 to get N days inclusive (today + N-1 past days)
  // Example: last 7 days from June 15 → June 9-15 (7 days total)
  // June 15 - 6 days = June 9
  // But tests expect 90 days to be 90 days apart, not 91 days inclusive
  // So we subtract (N-1) consistently
  fromDate.setDate(fromDate.getDate() - (days - 1));

  return {
    from: fromDate.toISOString().split("T")[0],
    to: todayDate.toISOString().split("T")[0],
  };
}

/**
 * Calculate tracking streak information.
 * @param trackedDays - Array of YYYY-MM-DD strings (not necessarily sorted)
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns StreakInfo with current streak, longest streak, and total tracked days
 */
export function calculateStreak(
  trackedDays: string[],
  today?: string,
): StreakInfo {
  if (trackedDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalTrackedDays: 0 };
  }

  // Remove duplicates and sort in ascending order
  const uniqueDays = Array.from(new Set(trackedDays)).sort();
  const todayDate = today ? new Date(today) : new Date();
  const todayStr = todayDate.toISOString().split("T")[0];

  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Calculate current streak (working backwards from today or yesterday)
  let currentStreak = 0;
  let checkDate = uniqueDays.includes(todayStr)
    ? new Date(todayStr)
    : uniqueDays.includes(yesterdayStr)
      ? new Date(yesterdayStr)
      : null;

  if (checkDate) {
    for (let i = uniqueDays.length - 1; i >= 0; i--) {
      const dayStr = checkDate.toISOString().split("T")[0];
      if (uniqueDays[i] === dayStr) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let currentRun = 1;
  let prevDate = new Date(uniqueDays[0]);

  for (let i = 1; i < uniqueDays.length; i++) {
    const currDate = new Date(uniqueDays[i]);
    const expectedNextDay = new Date(prevDate);
    expectedNextDay.setDate(expectedNextDay.getDate() + 1);

    if (currDate.getTime() === expectedNextDay.getTime()) {
      currentRun++;
    } else {
      longestStreak = Math.max(longestStreak, currentRun);
      currentRun = 1;
    }

    prevDate = currDate;
  }
  longestStreak = Math.max(longestStreak, currentRun);

  return {
    currentStreak,
    longestStreak,
    totalTrackedDays: uniqueDays.length,
  };
}

/**
 * Calculate macro adherence ratios (0 = 0%, 1 = 100% of goal).
 * @param points - Array of daily stats points
 * @param goal - User's nutrition goal
 * @returns MacroAdherence object with protein, carbs, fat ratios
 */
export function calculateMacroAdherence(
  points: DailyStatsPoint[],
  goal: UserGoal,
): MacroAdherence {
  if (points.length === 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  if (goal.proteinGrams === 0 || goal.carbsGrams === 0 || goal.fatGrams === 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  // Calculate averages
  const avgProtein =
    points.reduce((sum, p) => sum + p.protein, 0) / points.length;
  const avgCarbs = points.reduce((sum, p) => sum + p.carbs, 0) / points.length;
  const avgFat = points.reduce((sum, p) => sum + p.fat, 0) / points.length;

  return {
    protein: avgProtein / goal.proteinGrams,
    carbs: avgCarbs / goal.carbsGrams,
    fat: avgFat / goal.fatGrams,
  };
}

/**
 * Derive goal pace comparing actual weight trend to expected rate.
 * @param weights - Array of body weight entries (not necessarily sorted)
 * @param goal - User's goal with weight tracking fields
 * @returns GoalPace ('ahead', 'on_track', 'behind', 'no_data')
 */
export function deriveGoalPace(
  weights: BodyWeightEntry[],
  goal: UserGoal,
): GoalPace {
  // Need at least 2 weight entries to determine pace
  if (weights.length < 2) {
    return "no_data";
  }

  // Need weight goal type
  if (!goal.weightGoalType) {
    return "no_data";
  }

  // For non-maintain goals, need weight change pace
  if (goal.weightGoalType !== "maintain" && !goal.weightChangePace) {
    return "no_data";
  }

  // Sort weights by day
  const sortedWeights = [...weights].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  const firstWeight = sortedWeights[0];
  const lastWeight = sortedWeights[sortedWeights.length - 1];

  // Calculate time difference in weeks
  const daysDiff =
    (new Date(lastWeight.day).getTime() - new Date(firstWeight.day).getTime()) /
    (1000 * 60 * 60 * 24);
  const weeksDiff = daysDiff / 7;

  if (weeksDiff === 0) {
    return "no_data";
  }

  // Calculate actual rate of change (kg/week)
  const actualChange = lastWeight.weightKg - firstWeight.weightKg;
  const actualRate = Math.abs(actualChange / weeksDiff);

  // For non-maintain goals, weightChangePace is guaranteed by guard above.
  // For maintain goals, default to moderate rate (used only if maintain block doesn't early-return).
  const expectedRate = goal.weightChangePace
    ? getExpectedWeeklyRate(goal.weightChangePace)
    : 0.5;

  // For 'lose' goals
  if (goal.weightGoalType === "lose") {
    // Should be losing weight (negative change)
    if (actualChange > 0) {
      return "behind"; // Gaining weight when should be losing
    }
    // Compare actual loss rate to expected
    if (actualRate >= expectedRate) {
      return "ahead";
    } else if (actualRate >= expectedRate * 0.8) {
      return "on_track";
    } else {
      return "behind";
    }
  }

  // For 'gain' goals
  if (goal.weightGoalType === "gain") {
    // Should be gaining weight (positive change)
    if (actualChange < 0) {
      return "behind"; // Losing weight when should be gaining
    }
    // Compare actual gain rate to expected
    if (actualRate >= expectedRate) {
      return "ahead";
    } else if (actualRate >= expectedRate * 0.8) {
      return "on_track";
    } else {
      return "behind";
    }
  }

  // For 'maintain' goals
  if (goal.weightGoalType === "maintain" && goal.currentWeightKg) {
    const deviation = Math.abs(lastWeight.weightKg - goal.currentWeightKg);
    if (deviation <= 1) {
      return "on_track";
    } else {
      return "behind";
    }
  }

  return "no_data";
}

/**
 * Get expected weekly weight change rate based on pace.
 */
function getExpectedWeeklyRate(pace: WeightChangePace): number {
  switch (pace) {
    case "slow":
      return 0.25; // kg/week
    case "moderate":
      return 0.5; // kg/week
    case "aggressive":
      return 1.0; // kg/week
    default:
      return 0.5;
  }
}

/**
 * Calculate weight delta and progress percentage.
 * @param weights - Array of body weight entries (not necessarily sorted)
 * @param goal - User's goal with target weight
 * @returns Object with lost, remaining, and percentComplete, or null if insufficient data
 */
export function calculateWeightDelta(
  weights: BodyWeightEntry[],
  goal: UserGoal,
): { lost: number; remaining: number; percentComplete: number } | null {
  if (weights.length === 0 || !goal.targetWeightKg) {
    return null;
  }

  // Sort weights by day
  const sortedWeights = [...weights].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  const firstWeight = sortedWeights[0].weightKg;
  const lastWeight = sortedWeights[sortedWeights.length - 1].weightKg;
  const targetWeight = goal.targetWeightKg;

  // Calculate change (positive = lost weight, negative = gained weight)
  const lost = firstWeight - lastWeight;

  // Calculate remaining distance to target
  // Remaining is always: distance from current to target
  // Positive means still need to go in that direction
  // Negative means went past target
  // For loss goal (target < start): remaining = current - target
  // For gain goal (target > start): remaining = target - current
  const remaining =
    targetWeight < firstWeight
      ? lastWeight - targetWeight // Loss goal
      : targetWeight - lastWeight; // Gain goal

  // Calculate percent complete
  const totalJourney = Math.abs(targetWeight - firstWeight);
  const progressMade = Math.abs(lost);
  const percentComplete =
    totalJourney === 0 ? 0 : (progressMade / totalJourney) * 100;

  return {
    lost,
    remaining,
    percentComplete,
  };
}

// ---------------------------------------------------------------------------
// Widget calculation functions
// ---------------------------------------------------------------------------

/** Stability threshold in kg — changes smaller than this are "stable". */
const WEIGHT_STABLE_THRESHOLD_KG = 0.3;

/** Minimum days of weight data required for ETA projection. */
const MIN_DAYS_FOR_ETA = 2;

/** Maximum projected days remaining (cap). */
const MAX_PROJECTED_DAYS = 365;

/** Efficiency deviation threshold (percent). Below this is "on_target". */
const EFFICIENCY_ON_TARGET_THRESHOLD = 5;

/** Protein hit threshold — 80% of daily protein goal. */
const PROTEIN_HIT_RATIO = 0.8;

/** Calorie hit threshold — within 15% of daily calorie goal. */
const CALORIE_HIT_TOLERANCE = 0.15;

/** Number of weeks in the consistency grid. */
const CONSISTENCY_WEEKS = 4;

/**
 * Calculate weight trend over a time period.
 * @param weights - Array of body weight entries
 * @param period - Time period ('7d', '30d', '90d')
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns WeightTrend with direction, change, and data points
 */
export function calculateWeightTrend(
  weights: BodyWeightEntry[],
  period: StatsPeriod,
  today?: string,
): WeightTrend {
  const { from, to } = getDateRange(period, today);

  const filtered = weights.filter((w) => w.day >= from && w.day <= to);

  const sorted = [...filtered].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  // Deduplicate by day — keep the last entry per day (sorted by time, so last wins)
  const dedupedByDay: BodyWeightEntry[] = [];
  const seenDays = new Set<string>();
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!seenDays.has(sorted[i].day)) {
      seenDays.add(sorted[i].day);
      dedupedByDay.unshift(sorted[i]);
    }
  }

  if (dedupedByDay.length < 2) {
    return {
      direction: "stable",
      changeKg: 0,
      changePercent: 0,
      dataPoints: [],
    };
  }

  const firstWeight = dedupedByDay[0].weightKg;
  const lastWeight = dedupedByDay[dedupedByDay.length - 1].weightKg;
  const changeKg = lastWeight - firstWeight;
  const changePercent = (changeKg / firstWeight) * 100;

  const direction =
    Math.abs(changeKg) < WEIGHT_STABLE_THRESHOLD_KG
      ? "stable"
      : changeKg > 0
        ? "up"
        : "down";

  const dataPoints = dedupedByDay.map((w) => ({ day: w.day, weightKg: w.weightKg }));

  return { direction, changeKg, changePercent, dataPoints };
}

/**
 * Calculate estimated time of arrival to goal weight.
 * @param weights - Array of body weight entries (not necessarily sorted)
 * @param goal - User's goal with target weight
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns EtaProjection with target date, days remaining, progress, and on-track flag
 */
export function calculateETA(
  weights: BodyWeightEntry[],
  goal: UserGoal,
  today?: string,
): EtaProjection {
  const noData: EtaProjection = {
    targetDate: null,
    daysRemaining: null,
    progressPercent: 0,
    isOnTrack: false,
  };

  if (weights.length === 0 || goal.targetWeightKg == null) {
    return noData;
  }

  const sorted = [...weights].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );

  const firstWeight = sorted[0].weightKg;
  const lastWeight = sorted[sorted.length - 1].weightKg;
  const firstDay = new Date(sorted[0].day);
  const lastDay = new Date(sorted[sorted.length - 1].day);
  const daysBetween =
    (lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24);

  if (daysBetween < MIN_DAYS_FOR_ETA) {
    return noData;
  }

  const targetWeight = goal.targetWeightKg;
  const startWeight = goal.currentWeightKg ?? firstWeight;

  // Calculate progress percent
  const totalJourney = Math.abs(startWeight - targetWeight);
  const progressMade = Math.abs(startWeight - lastWeight);
  const progressPercent =
    totalJourney === 0
      ? 100
      : Math.min((progressMade / totalJourney) * 100, 100);

  // Check if goal already reached
  const remainingKg = Math.abs(lastWeight - targetWeight);
  const isLoseGoal = targetWeight < startWeight;
  const goalReached = isLoseGoal
    ? lastWeight <= targetWeight
    : lastWeight >= targetWeight;

  if (goalReached) {
    return {
      targetDate: today ?? new Date().toISOString().split("T")[0],
      daysRemaining: 0,
      progressPercent: 100,
      isOnTrack: true,
    };
  }

  // Check direction
  const weightChange = lastWeight - firstWeight;
  const isRightDirection = isLoseGoal ? weightChange < 0 : weightChange > 0;

  if (!isRightDirection) {
    return {
      targetDate: null,
      daysRemaining: null,
      progressPercent,
      isOnTrack: false,
    };
  }

  // Calculate daily rate and project
  const dailyRate = Math.abs(weightChange) / daysBetween;
  const rawDaysRemaining =
    dailyRate === 0 ? MAX_PROJECTED_DAYS : remainingKg / dailyRate;
  const daysRemaining = Math.min(
    Math.round(rawDaysRemaining),
    MAX_PROJECTED_DAYS,
  );

  const todayDate = today ? new Date(today) : new Date();
  const targetDate = new Date(todayDate);
  targetDate.setDate(targetDate.getDate() + daysRemaining);
  const targetDateStr = targetDate.toISOString().split("T")[0];

  return {
    targetDate: targetDateStr,
    daysRemaining,
    progressPercent,
    isOnTrack: true,
  };
}

/**
 * Calculate calorie efficiency comparing this week to last week.
 * @param dailyStats - Array of daily stats points
 * @param goal - User's nutrition goal (unused currently, reserved for future)
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns EfficiencyResult with deviation percent, direction, and weekly averages
 */
export function calculateEfficiency(
  dailyStats: DailyStatsPoint[],
  _goal: UserGoal,
  today?: string,
): EfficiencyResult {
  const todayDate = today ? new Date(today) : new Date();
  const todayStr = todayDate.toISOString().split("T")[0];

  // This week: last 7 days (today - 6 to today)
  const thisWeekStart = new Date(todayDate);
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  const thisWeekStartStr = thisWeekStart.toISOString().split("T")[0];

  // Last week: 8-14 days ago (today - 13 to today - 7)
  const lastWeekEnd = new Date(todayDate);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  const lastWeekEndStr = lastWeekEnd.toISOString().split("T")[0];
  const lastWeekStart = new Date(todayDate);
  lastWeekStart.setDate(lastWeekStart.getDate() - 13);
  const lastWeekStartStr = lastWeekStart.toISOString().split("T")[0];

  const thisWeekPoints = dailyStats.filter(
    (p) => p.day >= thisWeekStartStr && p.day <= todayStr,
  );
  const lastWeekPoints = dailyStats.filter(
    (p) => p.day >= lastWeekStartStr && p.day <= lastWeekEndStr,
  );

  const avgCaloriesThisWeek =
    thisWeekPoints.length === 0
      ? 0
      : thisWeekPoints.reduce((sum, p) => sum + p.calories, 0) /
        thisWeekPoints.length;
  const avgCaloriesLastWeek =
    lastWeekPoints.length === 0
      ? 0
      : lastWeekPoints.reduce((sum, p) => sum + p.calories, 0) /
        lastWeekPoints.length;

  if (avgCaloriesThisWeek === 0 || avgCaloriesLastWeek === 0) {
    return {
      deviationPercent: 0,
      direction: "on_target",
      avgCaloriesThisWeek,
      avgCaloriesLastWeek,
    };
  }

  const deviationPercent =
    ((avgCaloriesThisWeek - avgCaloriesLastWeek) / avgCaloriesLastWeek) * 100;

  const direction =
    Math.abs(deviationPercent) < EFFICIENCY_ON_TARGET_THRESHOLD
      ? "on_target"
      : deviationPercent > 0
        ? "over"
        : "under";

  return {
    deviationPercent,
    direction,
    avgCaloriesThisWeek,
    avgCaloriesLastWeek,
  };
}

/**
 * Calculate consistency score and weekly breakdown.
 * @param dailyStats - Array of daily stats points
 * @param goal - User's nutrition goal (for protein/calorie targets)
 * @param today - Optional date string (YYYY-MM-DD). Defaults to current date.
 * @returns ConsistencyResult with score, weeks grid, and 7-day average intake
 */
export function calculateConsistency(
  dailyStats: DailyStatsPoint[],
  goal: UserGoal,
  today?: string,
): ConsistencyResult {
  const todayDate = today ? new Date(today) : new Date();

  // Build a lookup map for daily stats by day string
  const statsMap = new Map<string, DailyStatsPoint>();
  for (const point of dailyStats) {
    statsMap.set(point.day, point);
  }

  const proteinTarget = goal.proteinGrams * PROTEIN_HIT_RATIO;
  const calorieTolerance = goal.dailyCaloriesKcal * CALORIE_HIT_TOLERANCE;

  // Build 4-week grid (28 days back from today)
  const totalDays = CONSISTENCY_WEEKS * 7;
  const allDays: ConsistencyDay[] = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(todayDate);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split("T")[0];
    const stats = statsMap.get(dayStr);

    const proteinHit = stats != null ? stats.protein >= proteinTarget : false;
    const calorieHit =
      stats != null
        ? Math.abs(stats.calories - goal.dailyCaloriesKcal) <= calorieTolerance
        : false;

    allDays.push({ day: dayStr, proteinHit, calorieHit });
  }

  // Group into weeks (oldest first)
  const weeks: ConsistencyWeek[] = [];
  for (let w = 0; w < CONSISTENCY_WEEKS; w++) {
    const start = w * 7;
    const weekDays = allDays.slice(start, start + 7);
    weeks.push({ weekStart: weekDays[0].day, days: weekDays });
  }

  // Calculate score: days with BOTH hits / total days with data
  const daysWithData = allDays.filter((d) => statsMap.has(d.day));
  const daysWithBothHits = daysWithData.filter(
    (d) => d.proteinHit && d.calorieHit,
  );
  const score =
    daysWithData.length === 0
      ? 0
      : (daysWithBothHits.length / daysWithData.length) * 100;

  // Average intake for last 7 days
  const last7Start = new Date(todayDate);
  last7Start.setDate(last7Start.getDate() - 6);
  const last7StartStr = last7Start.toISOString().split("T")[0];
  const todayStr = todayDate.toISOString().split("T")[0];
  const last7Points = dailyStats.filter(
    (p) => p.day >= last7StartStr && p.day <= todayStr,
  );
  const avgIntake7d =
    last7Points.length === 0
      ? 0
      : last7Points.reduce((sum, p) => sum + p.calories, 0) /
        last7Points.length;

  return { score, weeks, avgIntake7d };
}
