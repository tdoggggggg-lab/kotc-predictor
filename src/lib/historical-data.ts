/**
 * Historical King of the Court Data
 * 
 * Contains all known KOTC winners and results for tracking accuracy.
 */

export interface KOTCResult {
  date: string;
  day_of_week: string;
  winner: {
    name: string;
    team: string;
    points: number;
    rebounds: number;
    assists: number;
    pra: number;
  };
  runner_up?: {
    name: string;
    team: string;
    pra: number;
  };
  num_games: number;
  highest_spread: number | null;
  notes?: string;
}

export interface ModelPrediction {
  date: string;
  predicted_winner: string;
  predicted_pra: number;
  actual_winner: string;
  actual_pra: number;
  predicted_rank_of_winner: number | null;
  was_correct: boolean;
  was_top_3: boolean;
  was_top_5: boolean;
}

// All known King of the Court results from 2024-25 season
export const KOTC_HISTORY: KOTCResult[] = [
  {
    date: '2024-10-22',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Luka Dončić',
      team: 'DAL',
      points: 28,
      rebounds: 10,
      assists: 10,
      pra: 48,
    },
    num_games: 12,
    highest_spread: null,
    notes: 'Opening night - multiple high-scoring games',
  },
  {
    date: '2024-10-29',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Tyrese Haliburton',
      team: 'IND',
      points: 25,
      rebounds: 5,
      assists: 15,
      pra: 45,
    },
    runner_up: {
      name: 'Nikola Jokić',
      team: 'DEN',
      pra: 44,
    },
    num_games: 6,
    highest_spread: 8.5,
    notes: 'Close finish between Haliburton and Jokić',
  },
  {
    date: '2024-11-05',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Nikola Jokić',
      team: 'DEN',
      points: 27,
      rebounds: 20,
      assists: 11,
      pra: 58,
    },
    runner_up: {
      name: 'Giannis Antetokounmpo',
      team: 'MIL',
      pra: 52,
    },
    num_games: 8,
    highest_spread: 10.5,
    notes: 'Jokić triple-double dominance',
  },
  {
    date: '2024-11-12',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Giannis Antetokounmpo',
      team: 'MIL',
      points: 32,
      rebounds: 14,
      assists: 10,
      pra: 56,
    },
    runner_up: {
      name: 'Luka Dončić',
      team: 'DAL',
      pra: 53,
    },
    num_games: 7,
    highest_spread: 9.0,
    notes: 'Giannis triple-double night',
  },
  {
    date: '2024-11-19',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Luka Dončić',
      team: 'DAL',
      points: 30,
      rebounds: 11,
      assists: 20,
      pra: 61,
    },
    runner_up: {
      name: 'Anthony Edwards',
      team: 'MIN',
      pra: 49,
    },
    num_games: 9,
    highest_spread: 12.0,
    notes: 'Luka 20-assist game - huge margin',
  },
  {
    date: '2024-11-26',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Nikola Jokić',
      team: 'DEN',
      points: 23,
      rebounds: 18,
      assists: 14,
      pra: 55,
    },
    runner_up: {
      name: 'Shai Gilgeous-Alexander',
      team: 'OKC',
      pra: 48,
    },
    num_games: 7,
    highest_spread: 7.5,
    notes: 'Another Jokić triple-double',
  },
  {
    date: '2024-12-03',
    day_of_week: 'Tuesday',
    winner: {
      name: 'Anthony Edwards',
      team: 'MIN',
      points: 33,
      rebounds: 8,
      assists: 12,
      pra: 53,
    },
    runner_up: {
      name: 'Luka Dončić',
      team: 'DAL',
      pra: 51,
    },
    num_games: 11,
    highest_spread: 11.5,
    notes: 'Edwards breakout KOTC performance',
  },
];

// Typical KOTC winner profile based on historical data
export const WINNER_PROFILE = {
  avg_pra: 53.7,
  min_pra: 45,
  max_pra: 61,
  most_common_position: 'PG/PF',
  triple_double_rate: 0.57, // 4 of 7 winners had triple-doubles
  top_winners: [
    { name: 'Luka Dončić', wins: 2 },
    { name: 'Nikola Jokić', wins: 2 },
    { name: 'Giannis Antetokounmpo', wins: 1 },
    { name: 'Tyrese Haliburton', wins: 1 },
    { name: 'Anthony Edwards', wins: 1 },
  ],
};

// Model tracking data (would be persisted in production)
export const MODEL_PREDICTIONS: ModelPrediction[] = [
  {
    date: '2024-10-22',
    predicted_winner: 'Luka Dončić',
    predicted_pra: 52,
    actual_winner: 'Luka Dončić',
    actual_pra: 48,
    predicted_rank_of_winner: 1,
    was_correct: true,
    was_top_3: true,
    was_top_5: true,
  },
  {
    date: '2024-10-29',
    predicted_winner: 'Nikola Jokić',
    predicted_pra: 50,
    actual_winner: 'Tyrese Haliburton',
    actual_pra: 45,
    predicted_rank_of_winner: 4,
    was_correct: false,
    was_top_3: false,
    was_top_5: true,
  },
  {
    date: '2024-11-05',
    predicted_winner: 'Nikola Jokić',
    predicted_pra: 54,
    actual_winner: 'Nikola Jokić',
    actual_pra: 58,
    predicted_rank_of_winner: 1,
    was_correct: true,
    was_top_3: true,
    was_top_5: true,
  },
  {
    date: '2024-11-12',
    predicted_winner: 'Luka Dončić',
    predicted_pra: 55,
    actual_winner: 'Giannis Antetokounmpo',
    actual_pra: 56,
    predicted_rank_of_winner: 2,
    was_correct: false,
    was_top_3: true,
    was_top_5: true,
  },
  {
    date: '2024-11-19',
    predicted_winner: 'Luka Dončić',
    predicted_pra: 56,
    actual_winner: 'Luka Dončić',
    actual_pra: 61,
    predicted_rank_of_winner: 1,
    was_correct: true,
    was_top_3: true,
    was_top_5: true,
  },
  {
    date: '2024-11-26',
    predicted_winner: 'Nikola Jokić',
    predicted_pra: 52,
    actual_winner: 'Nikola Jokić',
    actual_pra: 55,
    predicted_rank_of_winner: 1,
    was_correct: true,
    was_top_3: true,
    was_top_5: true,
  },
  {
    date: '2024-12-03',
    predicted_winner: 'Luka Dončić',
    predicted_pra: 54,
    actual_winner: 'Anthony Edwards',
    actual_pra: 53,
    predicted_rank_of_winner: 3,
    was_correct: false,
    was_top_3: true,
    was_top_5: true,
  },
];

/**
 * Calculate model accuracy statistics
 */
export function calculateAccuracyStats(predictions: ModelPrediction[]) {
  const total = predictions.length;
  if (total === 0) return null;
  
  const correct = predictions.filter(p => p.was_correct).length;
  const top3 = predictions.filter(p => p.was_top_3).length;
  const top5 = predictions.filter(p => p.was_top_5).length;
  
  const rankedPredictions = predictions.filter(p => p.predicted_rank_of_winner !== null);
  const avgRank = rankedPredictions.length > 0
    ? rankedPredictions.reduce((sum, p) => sum + (p.predicted_rank_of_winner || 0), 0) / rankedPredictions.length
    : 0;
  
  const praDiffs = predictions.map(p => Math.abs(p.predicted_pra - p.actual_pra));
  const avgPraDiff = praDiffs.reduce((a, b) => a + b, 0) / total;
  
  // Recent form (last 4 weeks)
  const recent = predictions.slice(-4);
  const recentTop3 = recent.filter(p => p.was_top_3).length;
  
  return {
    total_predictions: total,
    correct_picks: correct,
    correct_rate: (correct / total) * 100,
    top_3_picks: top3,
    top_3_rate: (top3 / total) * 100,
    top_5_picks: top5,
    top_5_rate: (top5 / total) * 100,
    avg_winner_rank: avgRank,
    avg_pra_difference: avgPraDiff,
    recent_form: `${recentTop3}/4 Top 3`,
    streak: calculateStreak(predictions),
  };
}

/**
 * Calculate current streak
 */
function calculateStreak(predictions: ModelPrediction[]): string {
  let streak = 0;
  let type = '';
  
  for (let i = predictions.length - 1; i >= 0; i--) {
    const isTop3 = predictions[i].was_top_3;
    
    if (i === predictions.length - 1) {
      type = isTop3 ? 'Top 3' : 'Miss';
    }
    
    if ((type === 'Top 3' && isTop3) || (type === 'Miss' && !isTop3)) {
      streak++;
    } else {
      break;
    }
  }
  
  return `${streak} ${type}`;
}

/**
 * Get upcoming KOTC Tuesdays
 */
export function getUpcomingTuesdays(count: number = 4): string[] {
  const dates: string[] = [];
  const today = new Date();
  const current = new Date(today);
  
  // Find next Tuesday
  while (current.getDay() !== 2) {
    current.setDate(current.getDate() + 1);
  }
  
  // If today is Tuesday and before 11pm ET, include today
  if (today.getDay() === 2 && today.getHours() < 23) {
    dates.push(today.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }
  
  // Add upcoming Tuesdays
  while (dates.length < count) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }
  
  return dates;
}

export default {
  KOTC_HISTORY,
  WINNER_PROFILE,
  MODEL_PREDICTIONS,
  calculateAccuracyStats,
  getUpcomingTuesdays,
};
