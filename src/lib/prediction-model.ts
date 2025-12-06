/**
 * King of the Court Prediction Model V1 (Weighted Scoring)
 * 
 * Calculates a "Ceiling Score" for each player to predict
 * who is most likely to lead the NBA in PRA on a given night.
 */

import { EnhancedPlayerData } from './espn-data';

export interface Prediction {
  // Player info
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  matchup: string;
  opponent: string;
  headshot: string | null;
  
  // Core predictions
  projected_pra: number;
  ceiling_pra: number;
  ceiling_score: number;
  
  // Component scores (0-100)
  component_scores: {
    recent_pra: number;
    ceiling_factor: number;
    volume: number;
    matchup: number;
    environment: number;
  };
  
  // Raw stats
  stats: {
    avg_pra_last_10: number;
    max_pra_last_10: number;
    std_dev_pra: number;
    usage_rate: number;
    minutes_per_game: number;
    triple_doubles: number;
    ppg: number;
    rpg: number;
    apg: number;
  };
  
  // Game context
  game_context: {
    spread: number | null;
    over_under: number | null;
    is_home: boolean;
  };
  
  // Analysis
  key_factors: string[];
  confidence: 'High' | 'Medium' | 'Low';
  last_10_pra: number[];
}

/**
 * Calculate Recent PRA Score (30% weight)
 */
function calculateRecentPraScore(player: EnhancedPlayerData): {
  score: number;
  avgPra: number;
  stdDev: number;
  maxPra: number;
} {
  const lastGames = player.last_games_pra || [];
  
  if (lastGames.length === 0) {
    return { score: 0, avgPra: player.pra_avg, stdDev: 0, maxPra: player.pra_avg };
  }
  
  // Weighted average (more recent games count more)
  const weights = lastGames.map((_, i) => i + 1);
  const weightedSum = lastGames.reduce((sum, pra, i) => sum + pra * weights[i], 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedAvg = weightedSum / totalWeight;
  
  const avgPra = lastGames.reduce((a, b) => a + b, 0) / lastGames.length;
  const maxPra = Math.max(...lastGames);
  
  // Standard deviation
  const stdDev = lastGames.length > 1
    ? Math.sqrt(lastGames.reduce((sum, val) => sum + Math.pow(val - avgPra, 2), 0) / lastGames.length)
    : 0;
  
  // Normalize to 0-100 (assuming max realistic PRA is ~70)
  const score = Math.min((weightedAvg / 70) * 100, 100);
  
  return { score, avgPra, stdDev, maxPra };
}

/**
 * Calculate Ceiling Factor (25% weight)
 */
function calculateCeilingFactor(
  player: EnhancedPlayerData,
  avgPra: number,
  stdDev: number,
  maxPra: number
): { score: number; ceilingPra: number } {
  // Statistical ceiling (1.5 std dev above mean)
  const statCeiling = avgPra + (1.5 * stdDev);
  
  // Weighted ceiling calculation
  const ceilingPra = (maxPra * 0.50) + (player.max_pra_last_10 * 0.30) + (statCeiling * 0.20);
  
  // Triple-double bonus
  const tdBonus = Math.min(player.triple_doubles * 2, 10);
  
  // Normalize to 0-100
  const score = Math.min((ceilingPra / 65) * 100 + tdBonus, 100);
  
  return { score, ceilingPra };
}

/**
 * Calculate Volume Score (20% weight)
 */
function calculateVolumeScore(player: EnhancedPlayerData): number {
  const usageRate = player.usage_rate || 20;
  const mpg = player.mpg || 28;
  
  // Normalize components
  const usageFactor = usageRate / 25;
  const minutesFactor = mpg / 34;
  
  let score = usageFactor * minutesFactor * 60;
  
  // Bonuses
  if (usageRate >= 30) score += 15;
  else if (usageRate >= 28) score += 8;
  
  if (mpg >= 36) score += 10;
  else if (mpg >= 34) score += 5;
  
  return Math.min(score, 100);
}

/**
 * Calculate Matchup Score (15% weight)
 */
function calculateMatchupScore(player: EnhancedPlayerData): number {
  let score = 50;
  const spread = player.spread;
  
  // Use spread as proxy for matchup quality
  if (spread !== null && spread !== undefined) {
    if (Math.abs(spread) <= 4) {
      score += 15; // Close game - competitive, starters play full minutes
    } else if (Math.abs(spread) <= 7) {
      score += 10; // Moderate spread
    } else if (Math.abs(spread) <= 10) {
      score += 5; // Could go either way
    } else {
      score -= 5; // Blowout risk - might sit starters
    }
  }
  
  // Away underdog bonus (often in pace-up spots)
  if (!player.is_home && spread && spread > 0) {
    score += 5;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Calculate Environment Score (10% weight)
 */
function calculateEnvironmentScore(player: EnhancedPlayerData): {
  score: number;
  factors: string[];
} {
  let score = 50;
  const factors: string[] = [];
  
  const ou = player.over_under;
  const spread = player.spread;
  
  // Over/Under impact
  if (ou !== null && ou !== undefined) {
    if (ou >= 235) {
      score += 20;
      factors.push(`High O/U (${ou})`);
    } else if (ou >= 228) {
      score += 12;
      factors.push(`Good O/U (${ou})`);
    } else if (ou >= 220) {
      score += 5;
    } else if (ou < 215) {
      score -= 10;
      factors.push(`Low O/U (${ou})`);
    }
  }
  
  // Blowout risk
  if (spread !== null && spread !== undefined) {
    const absSpread = Math.abs(spread);
    if (absSpread >= 12) {
      score -= 20;
      factors.push('Blowout risk');
    } else if (absSpread >= 8) {
      score -= 10;
      factors.push('Possible blowout');
    } else if (absSpread <= 4) {
      score += 10;
      factors.push('Close game expected');
    }
  }
  
  // Home court small boost
  if (player.is_home) {
    score += 3;
  }
  
  return { score: Math.min(Math.max(score, 0), 100), factors };
}

/**
 * Generate prediction for a single player
 */
export function predictPlayer(player: EnhancedPlayerData): Prediction {
  // Calculate component scores
  const { score: recentScore, avgPra, stdDev, maxPra } = calculateRecentPraScore(player);
  const { score: ceilingScore, ceilingPra } = calculateCeilingFactor(player, avgPra, stdDev, maxPra);
  const volumeScore = calculateVolumeScore(player);
  const matchupScore = calculateMatchupScore(player);
  const { score: envScore, factors: envFactors } = calculateEnvironmentScore(player);
  
  // Weighted total ceiling score
  const totalCeilingScore = 
    (recentScore * 0.30) +
    (ceilingScore * 0.25) +
    (volumeScore * 0.20) +
    (matchupScore * 0.15) +
    (envScore * 0.10);
  
  // Calculate projected PRA
  let projectedPra = avgPra * (totalCeilingScore / 70);
  projectedPra = Math.max(projectedPra, avgPra * 0.9);
  
  // Build key factors
  const keyFactors: string[] = [];
  
  if (player.usage_rate >= 30) {
    keyFactors.push(`Elite usage (${player.usage_rate}%)`);
  } else if (player.usage_rate >= 27) {
    keyFactors.push(`High usage (${player.usage_rate}%)`);
  }
  
  if (player.triple_doubles >= 3) {
    keyFactors.push(`${player.triple_doubles} triple-doubles`);
  }
  
  if (maxPra >= 55) {
    keyFactors.push(`High ceiling (max ${maxPra} PRA)`);
  }
  
  if (player.mpg >= 35) {
    keyFactors.push(`Heavy minutes (${player.mpg} MPG)`);
  }
  
  keyFactors.push(...envFactors.slice(0, 2));
  
  // Determine confidence
  let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
  if (stdDev <= 5 && player.games_played >= 15) {
    confidence = 'High';
  } else if (stdDev > 8 || player.games_played < 10) {
    confidence = 'Low';
  }
  
  return {
    player_id: player.player_id,
    player_name: player.player_name,
    team: player.team_abbrev,
    position: player.position,
    matchup: player.matchup || '',
    opponent: player.opponent_abbrev || '',
    headshot: player.headshot,
    
    projected_pra: Math.round(projectedPra * 10) / 10,
    ceiling_pra: Math.round(ceilingPra * 10) / 10,
    ceiling_score: Math.round(totalCeilingScore * 10) / 10,
    
    component_scores: {
      recent_pra: Math.round(recentScore * 10) / 10,
      ceiling_factor: Math.round(ceilingScore * 10) / 10,
      volume: Math.round(volumeScore * 10) / 10,
      matchup: Math.round(matchupScore * 10) / 10,
      environment: Math.round(envScore * 10) / 10,
    },
    
    stats: {
      avg_pra_last_10: Math.round(avgPra * 10) / 10,
      max_pra_last_10: maxPra,
      std_dev_pra: Math.round(stdDev * 10) / 10,
      usage_rate: player.usage_rate,
      minutes_per_game: player.mpg,
      triple_doubles: player.triple_doubles,
      ppg: player.ppg,
      rpg: player.rpg,
      apg: player.apg,
    },
    
    game_context: {
      spread: player.spread ?? null,
      over_under: player.over_under ?? null,
      is_home: player.is_home || false,
    },
    
    key_factors: keyFactors.slice(0, 4),
    confidence,
    last_10_pra: player.last_games_pra || [],
  };
}

/**
 * Generate predictions for all players and rank them
 */
export function predictAllPlayers(players: EnhancedPlayerData[]): Prediction[] {
  const predictions = players.map(predictPlayer);
  
  // Sort by ceiling score (highest first)
  predictions.sort((a, b) => b.ceiling_score - a.ceiling_score);
  
  return predictions;
}

export default {
  predictPlayer,
  predictAllPlayers,
};
