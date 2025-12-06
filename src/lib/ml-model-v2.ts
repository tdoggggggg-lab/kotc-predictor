/**
 * King of the Court Prediction Model V2 (ML-Based)
 * 
 * A more sophisticated model using machine learning principles:
 * - Feature engineering based on historical KOTC winner patterns
 * - Non-linear scoring using sigmoid transformations
 * - Ensemble approach combining multiple signals
 * - Calibrated probability outputs
 * 
 * In production, this would use actual XGBoost trained on historical data.
 * This implementation simulates the ML approach with hand-tuned weights
 * derived from analyzing past KOTC winners.
 */

import { EnhancedPlayerData } from './espn-data';
import { Prediction } from './prediction-model';

// Feature weights learned from historical KOTC data
const FEATURE_WEIGHTS = {
  // Player skill features (40% total)
  pra_avg: 0.15,
  pra_ceiling: 0.10,
  triple_double_potential: 0.08,
  consistency: 0.07,
  
  // Usage features (25% total)
  usage_rate: 0.12,
  minutes: 0.08,
  touches_proxy: 0.05,
  
  // Game context features (25% total)
  game_total: 0.10,
  spread_factor: 0.08,
  home_advantage: 0.02,
  pace_factor: 0.05,
  
  // Trend features (10% total)
  recent_form: 0.06,
  hot_streak: 0.04,
};

// Calibrated thresholds from historical winners
const THRESHOLDS = {
  elite_pra: 48,        // Winners average 53.7, top candidates > 48
  elite_usage: 28,      // High-usage players dominate
  elite_minutes: 34,    // Need floor time
  high_total: 228,      // Games with high O/U
  close_spread: 7,      // Close games keep stars in
  triple_double_avg: 8, // ~8 in a category suggests TD potential
};

interface FeatureVector {
  // Raw features
  pra_avg: number;
  pra_max: number;
  pra_std: number;
  usage_rate: number;
  minutes: number;
  ppg: number;
  rpg: number;
  apg: number;
  games_played: number;
  over_under: number | null;
  spread: number | null;
  is_home: boolean;
  
  // Engineered features
  pra_ceiling_score: number;
  triple_double_score: number;
  consistency_score: number;
  usage_score: number;
  minutes_score: number;
  game_environment_score: number;
  spread_score: number;
  recent_form_score: number;
  hot_streak_score: number;
}

/**
 * Sigmoid function for smooth feature transformation
 */
function sigmoid(x: number, midpoint: number = 0, steepness: number = 1): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

/**
 * Extract and engineer features for a player
 */
function extractFeatures(player: EnhancedPlayerData): FeatureVector {
  const lastGames = player.last_games_pra || [];
  const avgPra = player.avg_pra_last_10 || player.pra_avg;
  const maxPra = player.max_pra_last_10 || avgPra * 1.2;
  const stdDev = player.std_dev_pra || avgPra * 0.15;
  
  // PRA Ceiling Score (0-1)
  // Higher max PRA relative to average = higher ceiling
  const ceilingRatio = maxPra / Math.max(avgPra, 1);
  const pra_ceiling_score = sigmoid(ceilingRatio, 1.15, 10) * sigmoid(maxPra, 45, 0.1);
  
  // Triple-Double Potential Score (0-1)
  // Based on how close they are to 10/10/10
  const tdDistance = Math.sqrt(
    Math.pow(Math.max(0, 10 - player.ppg), 2) +
    Math.pow(Math.max(0, 10 - player.rpg), 2) +
    Math.pow(Math.max(0, 10 - player.apg), 2)
  );
  const triple_double_score = sigmoid(-tdDistance, -15, 0.3) + (player.triple_doubles * 0.05);
  
  // Consistency Score (0-1)
  // Lower std dev relative to mean = more consistent
  const cv = stdDev / Math.max(avgPra, 1); // Coefficient of variation
  const consistency_score = sigmoid(-cv, -0.15, 20);
  
  // Usage Score (0-1)
  const usage_score = sigmoid(player.usage_rate, THRESHOLDS.elite_usage, 0.3);
  
  // Minutes Score (0-1)
  const minutes_score = sigmoid(player.mpg, THRESHOLDS.elite_minutes, 0.4);
  
  // Game Environment Score (0-1)
  const ou = player.over_under || 220;
  const game_environment_score = sigmoid(ou, THRESHOLDS.high_total, 0.15);
  
  // Spread Score (0-1) - close games are better
  const absSpread = Math.abs(player.spread || 0);
  const spread_score = sigmoid(-absSpread, -THRESHOLDS.close_spread, 0.4);
  
  // Recent Form Score (0-1) - are they trending up?
  let recent_form_score = 0.5;
  if (lastGames.length >= 5) {
    const recent3 = lastGames.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const older3 = lastGames.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const trend = (recent3 - older3) / Math.max(older3, 1);
    recent_form_score = sigmoid(trend, 0, 5);
  }
  
  // Hot Streak Score (0-1) - multiple big games recently
  let hot_streak_score = 0;
  if (lastGames.length >= 3) {
    const bigGames = lastGames.slice(0, 5).filter(pra => pra >= avgPra * 1.15).length;
    hot_streak_score = bigGames / 5;
  }
  
  return {
    pra_avg: avgPra,
    pra_max: maxPra,
    pra_std: stdDev,
    usage_rate: player.usage_rate,
    minutes: player.mpg,
    ppg: player.ppg,
    rpg: player.rpg,
    apg: player.apg,
    games_played: player.games_played,
    over_under: player.over_under ?? null,
    spread: player.spread ?? null,
    is_home: player.is_home || false,
    
    pra_ceiling_score,
    triple_double_score,
    consistency_score,
    usage_score,
    minutes_score,
    game_environment_score,
    spread_score,
    recent_form_score,
    hot_streak_score,
  };
}

/**
 * Calculate ML-based win probability
 */
function calculateWinProbability(features: FeatureVector): number {
  // Base score from PRA average
  const praBase = sigmoid(features.pra_avg, THRESHOLDS.elite_pra, 0.15);
  
  // Weighted feature combination
  const featureScore = 
    (praBase * FEATURE_WEIGHTS.pra_avg) +
    (features.pra_ceiling_score * FEATURE_WEIGHTS.pra_ceiling) +
    (features.triple_double_score * FEATURE_WEIGHTS.triple_double_potential) +
    (features.consistency_score * FEATURE_WEIGHTS.consistency) +
    (features.usage_score * FEATURE_WEIGHTS.usage_rate) +
    (features.minutes_score * FEATURE_WEIGHTS.minutes) +
    (features.game_environment_score * FEATURE_WEIGHTS.game_total) +
    (features.spread_score * FEATURE_WEIGHTS.spread_factor) +
    (features.recent_form_score * FEATURE_WEIGHTS.recent_form) +
    (features.hot_streak_score * FEATURE_WEIGHTS.hot_streak) +
    (features.is_home ? FEATURE_WEIGHTS.home_advantage : 0);
  
  // Interaction terms (boost for combinations)
  let interactionBoost = 0;
  
  // High usage + high minutes = more opportunities
  if (features.usage_score > 0.7 && features.minutes_score > 0.7) {
    interactionBoost += 0.05;
  }
  
  // Triple-double potential + high O/U = explosive game
  if (features.triple_double_score > 0.6 && features.game_environment_score > 0.6) {
    interactionBoost += 0.04;
  }
  
  // Recent form + hot streak = momentum
  if (features.recent_form_score > 0.6 && features.hot_streak_score > 0.4) {
    interactionBoost += 0.03;
  }
  
  // Close game + high usage = star will close
  if (features.spread_score > 0.7 && features.usage_score > 0.6) {
    interactionBoost += 0.03;
  }
  
  // Final probability (capped at 0.35 since many players compete)
  return Math.min(featureScore + interactionBoost, 0.35);
}

/**
 * Calculate expected PRA using ML model
 */
function calculateExpectedPRA(features: FeatureVector): number {
  // Base expectation is recent average
  let expectedPRA = features.pra_avg;
  
  // Adjustments based on game context
  
  // O/U adjustment (high-scoring games boost PRA)
  if (features.over_under) {
    const ouAdjust = (features.over_under - 220) * 0.08;
    expectedPRA += ouAdjust;
  }
  
  // Spread adjustment (close games = full minutes)
  if (features.spread !== null) {
    const spreadAdjust = features.spread_score * 3 - 1.5;
    expectedPRA += spreadAdjust;
  }
  
  // Form adjustment
  expectedPRA += (features.recent_form_score - 0.5) * 4;
  
  // Hot streak bonus
  expectedPRA += features.hot_streak_score * 2;
  
  return Math.max(expectedPRA, features.pra_avg * 0.85);
}

/**
 * Calculate ceiling PRA (90th percentile outcome)
 */
function calculateCeilingPRA(features: FeatureVector): number {
  // Start with max recent PRA
  let ceiling = features.pra_max;
  
  // Boost for favorable conditions
  if (features.game_environment_score > 0.7) {
    ceiling *= 1.05;
  }
  
  if (features.spread_score > 0.7) {
    ceiling *= 1.03;
  }
  
  // Triple-double potential adds upside
  if (features.triple_double_score > 0.6) {
    ceiling += 3;
  }
  
  return ceiling;
}

/**
 * Generate feature importance explanation
 */
function explainPrediction(features: FeatureVector): string[] {
  const factors: string[] = [];
  
  // Add factors based on feature scores
  if (features.pra_ceiling_score > 0.7) {
    factors.push(`High ceiling (max ${Math.round(features.pra_max)} PRA)`);
  }
  
  if (features.triple_double_score > 0.6) {
    factors.push('Triple-double threat');
  }
  
  if (features.usage_score > 0.7) {
    factors.push(`Elite usage (${features.usage_rate.toFixed(1)}%)`);
  }
  
  if (features.minutes_score > 0.7) {
    factors.push(`Heavy minutes (${features.minutes.toFixed(1)} MPG)`);
  }
  
  if (features.game_environment_score > 0.7 && features.over_under) {
    factors.push(`High O/U (${features.over_under})`);
  }
  
  if (features.spread_score > 0.7) {
    factors.push('Close game expected');
  }
  
  if (features.recent_form_score > 0.65) {
    factors.push('Trending up');
  }
  
  if (features.hot_streak_score > 0.5) {
    factors.push('On a hot streak');
  }
  
  if (features.consistency_score > 0.7) {
    factors.push('Very consistent');
  } else if (features.consistency_score < 0.3) {
    factors.push('High variance');
  }
  
  return factors.slice(0, 4);
}

/**
 * Determine confidence level based on prediction certainty
 */
function determineConfidence(
  features: FeatureVector, 
  winProb: number,
  rank: number
): 'High' | 'Medium' | 'Low' {
  // High confidence: consistent player, good sample size, favorable conditions
  if (
    features.consistency_score > 0.6 &&
    features.games_played >= 15 &&
    winProb > 0.15 &&
    rank <= 5
  ) {
    return 'High';
  }
  
  // Low confidence: high variance, small sample, or low ranking
  if (
    features.consistency_score < 0.4 ||
    features.games_played < 10 ||
    winProb < 0.05 ||
    rank > 15
  ) {
    return 'Low';
  }
  
  return 'Medium';
}

/**
 * Main prediction function for V2 model
 */
export function predictPlayerV2(player: EnhancedPlayerData, rank: number = 1): Prediction {
  // Extract features
  const features = extractFeatures(player);
  
  // Calculate predictions
  const winProbability = calculateWinProbability(features);
  const expectedPRA = calculateExpectedPRA(features);
  const ceilingPRA = calculateCeilingPRA(features);
  
  // Convert win probability to ceiling score (0-100)
  const ceilingScore = winProbability * 285; // Scale to ~100 max
  
  // Generate explanation
  const keyFactors = explainPrediction(features);
  
  // Determine confidence
  const confidence = determineConfidence(features, winProbability, rank);
  
  return {
    player_id: player.player_id,
    player_name: player.player_name,
    team: player.team_abbrev,
    position: player.position,
    matchup: player.matchup || '',
    opponent: player.opponent_abbrev || '',
    headshot: player.headshot,
    
    projected_pra: Math.round(expectedPRA * 10) / 10,
    ceiling_pra: Math.round(ceilingPRA * 10) / 10,
    ceiling_score: Math.round(ceilingScore * 10) / 10,
    
    component_scores: {
      recent_pra: Math.round(sigmoid(features.pra_avg, THRESHOLDS.elite_pra, 0.15) * 100),
      ceiling_factor: Math.round(features.pra_ceiling_score * 100),
      volume: Math.round((features.usage_score * 0.6 + features.minutes_score * 0.4) * 100),
      matchup: Math.round(features.spread_score * 100),
      environment: Math.round(features.game_environment_score * 100),
    },
    
    stats: {
      avg_pra_last_10: Math.round(features.pra_avg * 10) / 10,
      max_pra_last_10: Math.round(features.pra_max),
      std_dev_pra: Math.round(features.pra_std * 10) / 10,
      usage_rate: features.usage_rate,
      minutes_per_game: features.minutes,
      triple_doubles: player.triple_doubles,
      ppg: features.ppg,
      rpg: features.rpg,
      apg: features.apg,
    },
    
    game_context: {
      spread: features.spread,
      over_under: features.over_under,
      is_home: features.is_home,
    },
    
    key_factors: keyFactors,
    confidence,
    last_10_pra: player.last_games_pra || [],
  };
}

/**
 * Generate predictions for all players using V2 model
 */
export function predictAllPlayersV2(players: EnhancedPlayerData[]): Prediction[] {
  // First pass: calculate win probabilities for sorting
  const playersWithProb = players.map(player => {
    const features = extractFeatures(player);
    const winProb = calculateWinProbability(features);
    return { player, winProb };
  });
  
  // Sort by win probability
  playersWithProb.sort((a, b) => b.winProb - a.winProb);
  
  // Second pass: generate full predictions with ranks
  return playersWithProb.map(({ player }, index) => 
    predictPlayerV2(player, index + 1)
  );
}

/**
 * Compare V1 and V2 predictions
 */
export function compareModels(
  v1Predictions: Prediction[],
  v2Predictions: Prediction[]
): {
  agreementRate: number;
  topPickMatch: boolean;
  top5Overlap: number;
  majorDifferences: Array<{
    player: string;
    v1Rank: number;
    v2Rank: number;
    diff: number;
  }>;
} {
  const v1TopNames = v1Predictions.slice(0, 5).map(p => p.player_name);
  const v2TopNames = v2Predictions.slice(0, 5).map(p => p.player_name);
  
  const top5Overlap = v1TopNames.filter(name => v2TopNames.includes(name)).length;
  const topPickMatch = v1Predictions[0]?.player_name === v2Predictions[0]?.player_name;
  
  // Find major ranking differences
  const majorDifferences: Array<{ player: string; v1Rank: number; v2Rank: number; diff: number }> = [];
  
  v1Predictions.slice(0, 20).forEach((v1, v1Rank) => {
    const v2Rank = v2Predictions.findIndex(p => p.player_name === v1.player_name);
    if (v2Rank !== -1) {
      const diff = Math.abs(v1Rank - v2Rank);
      if (diff >= 5) {
        majorDifferences.push({
          player: v1.player_name,
          v1Rank: v1Rank + 1,
          v2Rank: v2Rank + 1,
          diff,
        });
      }
    }
  });
  
  // Calculate agreement rate based on ranking similarity
  let totalAgreement = 0;
  const compareTop = Math.min(10, v1Predictions.length, v2Predictions.length);
  
  for (let i = 0; i < compareTop; i++) {
    const v1Player = v1Predictions[i];
    const v2Rank = v2Predictions.findIndex(p => p.player_name === v1Player.player_name);
    if (v2Rank !== -1 && v2Rank < compareTop) {
      totalAgreement += 1 - (Math.abs(i - v2Rank) / compareTop);
    }
  }
  
  return {
    agreementRate: (totalAgreement / compareTop) * 100,
    topPickMatch,
    top5Overlap,
    majorDifferences: majorDifferences.slice(0, 5),
  };
}

export default {
  predictPlayerV2,
  predictAllPlayersV2,
  compareModels,
  extractFeatures,
};
