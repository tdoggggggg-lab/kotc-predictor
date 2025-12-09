/**
 * King of the Court Prediction Model V1 (Stats-Focused)
 * 
 * V1 PRIORITIZES RAW STATS (60%) over game context (40%)
 * Best for: Identifying highest-ceiling players regardless of matchup
 * 
 * Key factors: PRA average, ceiling, usage rate, triple-double history
 * Matchup adjustments are applied but don't dominate
 * 
 * Research-backed: Minutes is #1 predictor, usage rate correlates with FPPM
 */

import { EnhancedPlayerData } from './espn-data';

// 2024-25 NBA Team Defensive Ratings (points allowed per 100 possessions)
// Lower = better defense. League average ~112
const TEAM_DEFENSIVE_RATINGS: Record<string, number> = {
  'CLE': 105.2, 'OKC': 106.8, 'BOS': 107.5, 'MEM': 108.1, 'HOU': 108.5,
  'NYK': 109.2, 'LAC': 109.8, 'ORL': 110.1, 'MIA': 110.5, 'DEN': 110.8,
  'MIN': 111.0, 'GSW': 111.3, 'LAL': 111.5, 'MIL': 111.8, 'SAC': 112.0,
  'PHX': 112.3, 'DAL': 112.5, 'IND': 112.8, 'CHI': 113.2, 'BKN': 113.5,
  'ATL': 114.0, 'TOR': 114.5, 'POR': 115.0, 'SAS': 115.5, 'DET': 116.0,
  'PHI': 116.2, 'CHA': 116.8, 'UTA': 117.2, 'WAS': 118.5, 'NOP': 118.8,
};

// 2024-25 NBA Team Pace (possessions per 48 minutes)
// Higher = faster pace = more stats. League average ~100
const TEAM_PACE: Record<string, number> = {
  'IND': 103.5, 'ATL': 102.8, 'MIL': 102.2, 'SAC': 101.8, 'NOP': 101.5,
  'DEN': 101.2, 'UTA': 101.0, 'POR': 100.8, 'CHI': 100.5, 'PHX': 100.3,
  'DAL': 100.0, 'LAL': 99.8, 'BOS': 99.5, 'CHA': 99.3, 'MIN': 99.0,
  'TOR': 98.8, 'WAS': 98.5, 'BKN': 98.3, 'GSW': 98.0, 'DET': 97.8,
  'HOU': 97.5, 'SAS': 97.2, 'PHI': 97.0, 'NYK': 96.8, 'LAC': 96.5,
  'ORL': 96.2, 'MIA': 96.0, 'OKC': 95.8, 'MEM': 95.5, 'CLE': 95.2,
};

// Position-specific PRA allowed by opponent (guards vs bigs face different defenses)
// Research: Position matchups create 2-4 PRA swings
const POSITION_DEFENSE_MODIFIER: Record<string, Record<string, number>> = {
  // Guards (PG/SG) - these teams are weak against guards
  'PG': { 'WAS': 1.08, 'NOP': 1.07, 'CHA': 1.06, 'UTA': 1.05, 'CLE': 0.94, 'OKC': 0.95 },
  'SG': { 'WAS': 1.07, 'NOP': 1.06, 'DET': 1.05, 'UTA': 1.05, 'CLE': 0.94, 'BOS': 0.95 },
  // Forwards (SF/PF) - these teams are weak against wings
  'SF': { 'CHA': 1.08, 'WAS': 1.07, 'POR': 1.06, 'UTA': 1.05, 'OKC': 0.94, 'BOS': 0.95 },
  'PF': { 'CHA': 1.07, 'NOP': 1.06, 'DET': 1.05, 'WAS': 1.05, 'CLE': 0.94, 'OKC': 0.95 },
  // Centers - these teams are weak against bigs
  'C': { 'CHA': 1.10, 'WAS': 1.08, 'NOP': 1.07, 'UTA': 1.06, 'CLE': 0.93, 'OKC': 0.94 },
};

export interface Prediction {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  matchup: string;
  opponent: string;
  headshot: string | null;
  
  projected_pra: number;
  ceiling_pra: number;
  ceiling_score: number;
  
  component_scores: {
    recent_pra: number;
    ceiling_factor: number;
    volume: number;
    matchup: number;
    environment: number;
  };
  
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
  
  game_context: {
    spread: number | null;
    over_under: number | null;
    is_home: boolean;
    opponent_drtg?: number;
    opponent_pace?: number;
  };
  
  key_factors: string[];
  confidence: 'High' | 'Medium' | 'Low';
  last_10_pra: number[];
}

/**
 * Calculate Recent PRA Score (30% weight in V1)
 * Uses weighted average favoring recent games + hot/cold streak detection
 */
function calculateRecentPraScore(player: EnhancedPlayerData): {
  score: number;
  avgPra: number;
  stdDev: number;
  maxPra: number;
  hotStreak: boolean;
  coldStreak: boolean;
} {
  const lastGames = player.last_games_pra || [];
  
  if (lastGames.length === 0) {
    return { score: 0, avgPra: player.pra_avg, stdDev: 0, maxPra: player.pra_avg, hotStreak: false, coldStreak: false };
  }
  
  // Weighted average (more recent = higher weight)
  const weights = lastGames.map((_, i) => i + 1);
  const weightedSum = lastGames.reduce((sum, pra, i) => sum + pra * weights[i], 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedAvg = weightedSum / totalWeight;
  
  const avgPra = lastGames.reduce((a, b) => a + b, 0) / lastGames.length;
  const maxPra = Math.max(...lastGames);
  
  const stdDev = lastGames.length > 1
    ? Math.sqrt(lastGames.reduce((sum, val) => sum + Math.pow(val - avgPra, 2), 0) / lastGames.length)
    : 0;
  
  // HOT/COLD STREAK DETECTION (Research: recency matters but don't overweight)
  // Last 3 games vs overall average
  const last3 = lastGames.slice(-3);
  const last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : avgPra;
  const hotStreak = last3Avg > avgPra * 1.10; // 10%+ above average
  const coldStreak = last3Avg < avgPra * 0.90; // 10%+ below average
  
  // Normalize to 0-100 (elite PRA ~55+)
  let score = Math.min((weightedAvg / 60) * 100, 100);
  
  // V1 gives small streak adjustments (research: don't overweight recency)
  if (hotStreak) score += 5;
  if (coldStreak) score -= 3;
  
  return { score, avgPra, stdDev, maxPra, hotStreak, coldStreak };
}

/**
 * Calculate Ceiling Factor (20% weight)
 * Based on max PRA, std dev, and triple-double potential
 */
function calculateCeilingFactor(
  player: EnhancedPlayerData,
  avgPra: number,
  stdDev: number,
  maxPra: number
): { score: number; ceilingPra: number } {
  // Statistical ceiling (1.5 std dev above mean)
  const statCeiling = avgPra + (1.5 * stdDev);
  
  // Weighted ceiling: max matters most for KOTC (ceiling contest)
  const ceilingPra = (maxPra * 0.55) + (player.max_pra_last_10 * 0.25) + (statCeiling * 0.20);
  
  // Triple-double bonus (research shows TD-capable players win KOTC more)
  const tdBonus = Math.min(player.triple_doubles * 3, 15);
  
  const score = Math.min((ceilingPra / 60) * 100 + tdBonus, 100);
  
  return { score, ceilingPra };
}

/**
 * Calculate Volume Score (15% weight)
 * Minutes and usage rate - research shows minutes is #1 predictor
 */
function calculateVolumeScore(player: EnhancedPlayerData): number {
  const usageRate = player.usage_rate || 20;
  const mpg = player.mpg || 28;
  
  // Minutes is the strongest predictor per research
  const minutesScore = Math.min((mpg / 36) * 60, 60);
  
  // Usage adds upside
  const usageScore = Math.min((usageRate / 30) * 40, 40);
  
  let score = minutesScore + usageScore;
  
  // Elite thresholds
  if (mpg >= 36 && usageRate >= 30) score += 10;
  else if (mpg >= 35 && usageRate >= 28) score += 5;
  
  return Math.min(score, 100);
}

/**
 * Calculate Matchup Score (25% weight) - Uses opponent DRTG, pace, and POSITION
 * Research shows opponent defensive rating creates 3-5 PRA swing
 * Position-specific adjustments add 2-4 more PRA differentiation
 */
function calculateMatchupScore(player: EnhancedPlayerData): {
  score: number;
  factors: string[];
  oppDrtg: number;
  oppPace: number;
  positionMod: number;
} {
  let score = 50;
  const factors: string[] = [];
  
  const oppAbbrev = player.opponent_abbrev || '';
  const oppDrtg = TEAM_DEFENSIVE_RATINGS[oppAbbrev] || 112;
  const oppPace = TEAM_PACE[oppAbbrev] || 100;
  
  // Position-specific defense modifier (research: guards vs bigs face different defenses)
  const position = player.position?.toUpperCase() || 'SF';
  const posModifiers = POSITION_DEFENSE_MODIFIER[position] || {};
  const positionMod = posModifiers[oppAbbrev] || 1.0;
  
  // Opponent Defensive Rating (research: 3-5 PRA bump vs bad defenses)
  if (oppDrtg >= 117) {
    score += 18;
    factors.push(`🎯 Weak D (${oppDrtg.toFixed(0)} DRTG)`);
  } else if (oppDrtg >= 114) {
    score += 10;
    factors.push(`Good matchup (${oppDrtg.toFixed(0)} DRTG)`);
  } else if (oppDrtg >= 112) {
    score += 4;
  } else if (oppDrtg <= 107) {
    score -= 12;
    factors.push(`⚠️ Elite D (${oppDrtg.toFixed(0)} DRTG)`);
  } else if (oppDrtg <= 109) {
    score -= 6;
    factors.push(`Tough D (${oppDrtg.toFixed(0)} DRTG)`);
  }
  
  // Position-specific bonus/penalty
  if (positionMod >= 1.06) {
    score += 8;
    factors.push(`${position} crusher`);
  } else if (positionMod <= 0.95) {
    score -= 6;
    factors.push(`Tough ${position} D`);
  }
  
  // Opponent Pace (research: high pace = more possessions = more stats)
  if (oppPace >= 102) {
    score += 10;
    factors.push(`Fast pace (${oppPace.toFixed(0)})`);
  } else if (oppPace >= 100) {
    score += 5;
  } else if (oppPace <= 96) {
    score -= 6;
    factors.push(`Slow pace (${oppPace.toFixed(0)})`);
  }
  
  return { 
    score: Math.min(Math.max(score, 0), 100), 
    factors,
    oppDrtg,
    oppPace,
    positionMod,
  };
}

/**
 * Calculate Environment Score (15% weight)
 * O/U, spread, home court, blowout risk
 */
function calculateEnvironmentScore(player: EnhancedPlayerData): {
  score: number;
  factors: string[];
} {
  let score = 50;
  const factors: string[] = [];
  
  const ou = player.over_under;
  const spread = player.spread;
  
  // Over/Under (proxy for expected pace/possessions)
  if (ou !== null && ou !== undefined) {
    if (ou >= 235) {
      score += 18;
      factors.push(`High O/U (${ou})`);
    } else if (ou >= 228) {
      score += 10;
      factors.push(`Good O/U (${ou})`);
    } else if (ou < 218) {
      score -= 12;
      factors.push(`Low O/U (${ou})`);
    }
  }
  
  // Blowout Risk (research: 12+ spread = 33% minutes reduction)
  if (spread !== null && spread !== undefined) {
    const absSpread = Math.abs(spread);
    if (absSpread >= 14) {
      score -= 25;
      factors.push(`⚠️ Blowout risk (${spread > 0 ? '+' : ''}${spread})`);
    } else if (absSpread >= 10) {
      score -= 15;
      factors.push(`Blowout possible (${spread > 0 ? '+' : ''}${spread})`);
    } else if (absSpread <= 4) {
      score += 10;
      factors.push('Close game expected');
    }
  }
  
  // Home court (research: 2.5-3.5 point advantage)
  if (player.is_home) {
    score += 5;
    factors.push('Home');
  }
  
  return { score: Math.min(Math.max(score, 0), 100), factors };
}

/**
 * Generate prediction for a single player - V1 STATS-FOCUSED
 * 60% player skill/stats, 40% game context
 */
export function predictPlayer(player: EnhancedPlayerData): Prediction {
  const { score: recentScore, avgPra, stdDev, maxPra, hotStreak, coldStreak } = calculateRecentPraScore(player);
  const { score: ceilingScore, ceilingPra } = calculateCeilingFactor(player, avgPra, stdDev, maxPra);
  const volumeScore = calculateVolumeScore(player);
  const { score: matchupScore, factors: matchupFactors, oppDrtg, oppPace, positionMod } = calculateMatchupScore(player);
  const { score: envScore, factors: envFactors } = calculateEnvironmentScore(player);
  
  // V1 Weights: STATS-FOCUSED (75% stats, 25% context)
  // This means V1 will favor high-ceiling players even in tough matchups
  const totalCeilingScore = 
    (recentScore * 0.35) +      // Recent performance (STATS)
    (ceilingScore * 0.25) +     // Ceiling potential (STATS)
    (volumeScore * 0.15) +      // Minutes + usage (STATS)
    (matchupScore * 0.15) +     // Opponent factors (CONTEXT)
    (envScore * 0.10);          // Game environment (CONTEXT)
  
  // Calculate projected PRA with lighter matchup adjustment for V1
  // V1 trusts the player's baseline more
  const matchupMultiplier = 1 + ((oppDrtg - 112) / 150) * positionMod; // Softer adjustment
  let projectedPra = avgPra * matchupMultiplier * (totalCeilingScore / 60);
  projectedPra = Math.max(projectedPra, avgPra * 0.88);
  
  // Build key factors - V1 emphasizes player factors first
  const keyFactors: string[] = [];
  
  // Hot/cold streak indicators
  if (hotStreak) keyFactors.push('🔥 Hot streak');
  if (coldStreak) keyFactors.push('❄️ Cold streak');
  
  if (player.usage_rate >= 30) {
    keyFactors.push(`Elite usage (${player.usage_rate}%)`);
  }
  
  if (player.triple_doubles >= 3) {
    keyFactors.push(`TD threat (${player.triple_doubles})`);
  }
  
  // Add matchup factors after player factors
  keyFactors.push(...matchupFactors.slice(0, 2));
  keyFactors.push(...envFactors.slice(0, 1));
  
  // Confidence based on consistency
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
      opponent_drtg: oppDrtg,
      opponent_pace: oppPace,
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
  predictions.sort((a, b) => b.ceiling_score - a.ceiling_score);
  return predictions;
}

export default {
  predictPlayer,
  predictAllPlayers,
};
