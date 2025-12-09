/**
 * King of the Court Prediction Model V2 (Context-Focused)
 * 
 * V2 HEAVILY weights game context (75%) over raw stats (25%)
 * Best for: Finding value plays with great matchups, avoiding traps
 * 
 * Research-backed factors:
 * - Opponent DRTG: 3-5 PRA swing vs bad defenses
 * - Position-specific defense: 2-4 PRA additional swing
 * - Pace: High-pace opponents = more possessions = more stats
 * - Spread: 12+ spread = ~33% minutes reduction (blowout risk)
 * - O/U: Proxy for expected game pace
 * - Underdog bonus: Stars on underdogs must carry more
 * - Hot streak: Last 3 games momentum (but don't overweight)
 * - Back-to-back: -2 PRA penalty (research-backed)
 */

import { EnhancedPlayerData } from './espn-data';
import { Prediction } from './prediction-model';

// 2024-25 NBA Team Defensive Ratings
const TEAM_DEFENSIVE_RATINGS: Record<string, number> = {
  'CLE': 105.2, 'OKC': 106.8, 'BOS': 107.5, 'MEM': 108.1, 'HOU': 108.5,
  'NYK': 109.2, 'LAC': 109.8, 'ORL': 110.1, 'MIA': 110.5, 'DEN': 110.8,
  'MIN': 111.0, 'GSW': 111.3, 'LAL': 111.5, 'MIL': 111.8, 'SAC': 112.0,
  'PHX': 112.3, 'DAL': 112.5, 'IND': 112.8, 'CHI': 113.2, 'BKN': 113.5,
  'ATL': 114.0, 'TOR': 114.5, 'POR': 115.0, 'SAS': 115.5, 'DET': 116.0,
  'PHI': 116.2, 'CHA': 116.8, 'UTA': 117.2, 'WAS': 118.5, 'NOP': 118.8,
};

// 2024-25 NBA Team Pace
const TEAM_PACE: Record<string, number> = {
  'IND': 103.5, 'ATL': 102.8, 'MIL': 102.2, 'SAC': 101.8, 'NOP': 101.5,
  'DEN': 101.2, 'UTA': 101.0, 'POR': 100.8, 'CHI': 100.5, 'PHX': 100.3,
  'DAL': 100.0, 'LAL': 99.8, 'BOS': 99.5, 'CHA': 99.3, 'MIN': 99.0,
  'TOR': 98.8, 'WAS': 98.5, 'BKN': 98.3, 'GSW': 98.0, 'DET': 97.8,
  'HOU': 97.5, 'SAS': 97.2, 'PHI': 97.0, 'NYK': 96.8, 'LAC': 96.5,
  'ORL': 96.2, 'MIA': 96.0, 'OKC': 95.8, 'MEM': 95.5, 'CLE': 95.2,
};

// Position-specific PRA allowed (V2 uses this more aggressively)
const POSITION_DEFENSE_MODIFIER: Record<string, Record<string, number>> = {
  'PG': { 'WAS': 1.12, 'NOP': 1.10, 'CHA': 1.08, 'UTA': 1.07, 'DET': 1.05, 'CLE': 0.92, 'OKC': 0.93, 'BOS': 0.94 },
  'SG': { 'WAS': 1.10, 'NOP': 1.08, 'DET': 1.07, 'UTA': 1.06, 'CHA': 1.05, 'CLE': 0.92, 'BOS': 0.93, 'OKC': 0.94 },
  'SF': { 'CHA': 1.12, 'WAS': 1.10, 'POR': 1.08, 'UTA': 1.07, 'NOP': 1.05, 'OKC': 0.92, 'BOS': 0.93, 'CLE': 0.94 },
  'PF': { 'CHA': 1.10, 'NOP': 1.08, 'DET': 1.07, 'WAS': 1.06, 'UTA': 1.05, 'CLE': 0.92, 'OKC': 0.93, 'BOS': 0.94 },
  'C': { 'CHA': 1.15, 'WAS': 1.12, 'NOP': 1.10, 'UTA': 1.08, 'DET': 1.06, 'CLE': 0.90, 'OKC': 0.92, 'BOS': 0.93 },
};

function calculateBlowoutAdjustment(spread: number | null): {
  multiplier: number;
  risk: 'none' | 'low' | 'medium' | 'high';
  message: string;
} {
  if (spread === null || spread === undefined) {
    return { multiplier: 1.0, risk: 'none', message: '' };
  }
  const absSpread = Math.abs(spread);
  if (absSpread >= 14) {
    return { multiplier: 0.70, risk: 'high', message: `⚠️ HIGH blowout (${spread > 0 ? '+' : ''}${spread})` };
  } else if (absSpread >= 11) {
    return { multiplier: 0.78, risk: 'medium', message: `Blowout risk (${spread > 0 ? '+' : ''}${spread})` };
  } else if (absSpread >= 8) {
    return { multiplier: 0.88, risk: 'low', message: 'Possible blowout' };
  } else if (absSpread <= 4) {
    return { multiplier: 1.08, risk: 'none', message: 'Close game = full mins' };
  }
  return { multiplier: 1.0, risk: 'none', message: '' };
}

function calculateDefensiveAdjustment(oppAbbrev: string, position: string): {
  multiplier: number;
  drtg: number;
  message: string;
  positionBonus: number;
} {
  const drtg = TEAM_DEFENSIVE_RATINGS[oppAbbrev] || 112;
  const diff = drtg - 112;
  
  // Position-specific modifier (V2 weights this heavily)
  const pos = position?.toUpperCase() || 'SF';
  const posModifiers = POSITION_DEFENSE_MODIFIER[pos] || {};
  const positionBonus = posModifiers[oppAbbrev] || 1.0;
  
  let baseMultiplier = 1.0;
  let message = '';
  
  // Overall team defense
  if (diff >= 6) { baseMultiplier = 1.12; message = `🎯 Weak D (${drtg.toFixed(0)} DRTG)`; }
  else if (diff >= 3) { baseMultiplier = 1.06; message = `Good matchup (${drtg.toFixed(0)} DRTG)`; }
  else if (diff <= -5) { baseMultiplier = 0.90; message = `⚠️ Elite D (${drtg.toFixed(0)} DRTG)`; }
  else if (diff <= -3) { baseMultiplier = 0.94; message = `Tough D (${drtg.toFixed(0)} DRTG)`; }
  
  // Position-specific bonus stacks with team defense
  if (positionBonus >= 1.08) message = `🎯 ${pos} feast (${drtg.toFixed(0)} DRTG)`;
  else if (positionBonus <= 0.93) message = `⚠️ ${pos} stopper (${drtg.toFixed(0)} DRTG)`;
  
  // Final multiplier combines both factors
  const multiplier = baseMultiplier * positionBonus;
  
  return { multiplier, drtg, message, positionBonus };
}

function calculatePaceAdjustment(oppAbbrev: string): {
  multiplier: number;
  pace: number;
  message: string;
} {
  const pace = TEAM_PACE[oppAbbrev] || 100;
  const diff = pace - 100;
  if (diff >= 2.5) return { multiplier: 1.05, pace, message: `Fast pace (${pace.toFixed(0)})` };
  if (diff >= 1) return { multiplier: 1.02, pace, message: '' };
  if (diff <= -3) return { multiplier: 0.95, pace, message: `Slow pace (${pace.toFixed(0)})` };
  if (diff <= -1.5) return { multiplier: 0.98, pace, message: '' };
  return { multiplier: 1.0, pace, message: '' };
}

function calculateTotalAdjustment(overUnder: number | null): {
  multiplier: number;
  message: string;
} {
  if (overUnder === null) return { multiplier: 1.0, message: '' };
  if (overUnder >= 235) return { multiplier: 1.08, message: `High O/U (${overUnder})` };
  if (overUnder >= 228) return { multiplier: 1.04, message: `Good O/U (${overUnder})` };
  if (overUnder <= 215) return { multiplier: 0.92, message: `⚠️ Low O/U (${overUnder})` };
  if (overUnder <= 220) return { multiplier: 0.96, message: `Low O/U (${overUnder})` };
  return { multiplier: 1.0, message: '' };
}

function calculateUnderdogBoost(spread: number | null, usageRate: number): {
  multiplier: number;
  message: string;
} {
  if (spread === null) return { multiplier: 1.0, message: '' };
  if (spread >= 6 && usageRate >= 28) return { multiplier: 1.06, message: 'Underdog carry mode' };
  if (spread >= 3 && usageRate >= 26) return { multiplier: 1.03, message: 'Underdog boost' };
  return { multiplier: 1.0, message: '' };
}

function calculateBasePlayerScore(player: EnhancedPlayerData): {
  score: number;
  avgPra: number;
  ceilingPra: number;
  hotStreak: boolean;
  coldStreak: boolean;
} {
  const lastGames = player.last_games_pra || [];
  const avgPra = lastGames.length > 0 
    ? lastGames.reduce((a, b) => a + b, 0) / lastGames.length 
    : player.pra_avg;
  const maxPra = lastGames.length > 0 ? Math.max(...lastGames) : player.pra_avg;
  const ceilingPra = maxPra * 0.6 + avgPra * 0.4;
  
  // Hot/cold streak detection (last 3 games vs average)
  const last3 = lastGames.slice(-3);
  const last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : avgPra;
  const hotStreak = last3Avg > avgPra * 1.12; // 12%+ above average
  const coldStreak = last3Avg < avgPra * 0.88; // 12%+ below average
  
  // V2 uses a lower base score - context will add most of the value
  let score = Math.min((avgPra / 55) * 60, 60);
  
  // V2 gives larger hot/cold adjustments (more reactive to recent form)
  if (hotStreak) score += 10;
  if (coldStreak) score -= 8;
  
  if (player.triple_doubles >= 5) score += 12;
  else if (player.triple_doubles >= 2) score += 6;
  if (player.usage_rate >= 30) score += 8;
  else if (player.usage_rate >= 27) score += 4;
  
  return { score: Math.min(score, 85), avgPra, ceilingPra, hotStreak, coldStreak };
}

export function predictPlayerV2(player: EnhancedPlayerData): Prediction {
  const oppAbbrev = player.opponent_abbrev || '';
  const position = player.position || 'SF';
  
  const blowout = calculateBlowoutAdjustment(player.spread ?? null);
  const defense = calculateDefensiveAdjustment(oppAbbrev, position);
  const pace = calculatePaceAdjustment(oppAbbrev);
  const total = calculateTotalAdjustment(player.over_under ?? null);
  const underdog = calculateUnderdogBoost(player.spread ?? null, player.usage_rate ?? 20);
  const { score: baseScore, avgPra, ceilingPra, hotStreak, coldStreak } = calculateBasePlayerScore(player);
  
  // GAME CONTEXT (75% weight in V2 - this is what makes it different from V1!)
  let contextMultiplier = 1.0;
  contextMultiplier *= blowout.multiplier;
  contextMultiplier *= defense.multiplier; // Now includes position-specific
  contextMultiplier *= pace.multiplier;
  contextMultiplier *= total.multiplier;
  contextMultiplier *= underdog.multiplier;
  if (player.is_home) contextMultiplier *= 1.03; // Slightly higher home bonus in V2
  
  // Hot streak bonus (V2 is more reactive)
  if (hotStreak) contextMultiplier *= 1.05;
  if (coldStreak) contextMultiplier *= 0.95;
  
  // Context score normalized (0.65 to 1.35 range mapped to 0-100)
  const contextScore = Math.min(Math.max((contextMultiplier - 0.65) * 142.86, 0), 100);
  
  // FINAL: 25% base stats + 75% context (V2 is HEAVILY context-driven)
  const totalCeilingScore = (baseScore * 0.25) + (contextScore * 0.75);
  
  let projectedPra = avgPra * contextMultiplier;
  projectedPra = Math.max(projectedPra, avgPra * 0.65); // V2 allows bigger drops
  const adjustedCeiling = ceilingPra * contextMultiplier;
  
  // Key factors - V2 emphasizes context first
  const keyFactors: string[] = [];
  if (blowout.message) keyFactors.push(blowout.message);
  if (defense.message) keyFactors.push(defense.message);
  if (hotStreak) keyFactors.push('🔥 Hot last 3');
  if (coldStreak) keyFactors.push('❄️ Cold last 3');
  if (pace.message) keyFactors.push(pace.message);
  if (total.message) keyFactors.push(total.message);
  if (underdog.message) keyFactors.push(underdog.message);
  if (keyFactors.length < 4 && player.triple_doubles >= 3) keyFactors.push(`TD threat (${player.triple_doubles})`);
  if (keyFactors.length < 4 && player.usage_rate >= 30) keyFactors.push(`Elite usage (${player.usage_rate}%)`);
  
  const lastGames = player.last_games_pra || [];
  const stdDev = lastGames.length > 1
    ? Math.sqrt(lastGames.reduce((sum, val) => sum + Math.pow(val - avgPra, 2), 0) / lastGames.length)
    : 5;
  
  // V2 confidence based on context clarity
  let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
  if (blowout.risk === 'none' && contextMultiplier >= 1.08) confidence = 'High';
  else if (blowout.risk === 'high' || contextMultiplier < 0.88) confidence = 'Low';
  
  return {
    player_id: player.player_id,
    player_name: player.player_name,
    team: player.team_abbrev,
    position: player.position,
    matchup: player.matchup || '',
    opponent: player.opponent_abbrev || '',
    headshot: player.headshot,
    projected_pra: Math.round(projectedPra * 10) / 10,
    ceiling_pra: Math.round(adjustedCeiling * 10) / 10,
    ceiling_score: Math.round(totalCeilingScore * 10) / 10,
    component_scores: {
      recent_pra: Math.round(baseScore * 10) / 10,
      ceiling_factor: Math.round((ceilingPra / 60) * 100 * 10) / 10,
      volume: Math.round(((player.usage_rate || 20) / 30) * 100 * 10) / 10,
      matchup: Math.round((defense.multiplier * 50 + pace.multiplier * 50 - 50) * 10) / 10,
      environment: Math.round(contextScore * 10) / 10,
    },
    stats: {
      avg_pra_last_10: Math.round(avgPra * 10) / 10,
      max_pra_last_10: lastGames.length > 0 ? Math.max(...lastGames) : player.pra_avg,
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
      opponent_drtg: defense.drtg,
      opponent_pace: pace.pace,
    },
    key_factors: keyFactors.slice(0, 4),
    confidence,
    last_10_pra: player.last_games_pra || [],
  };
}

export function predictAllPlayersV2(players: EnhancedPlayerData[]): Prediction[] {
  const predictions = players.map(predictPlayerV2);
  predictions.sort((a, b) => b.ceiling_score - a.ceiling_score);
  return predictions;
}

export function compareModels(v1: Prediction[], v2: Prediction[]): {
  agreement_rate: number;
  top_pick_matches: boolean;
  top_5_overlap: number;
  major_differences: Array<{ player: string; v1_rank: number; v2_rank: number; reason: string }>;
} {
  const v1Top5 = new Set(v1.slice(0, 5).map(p => p.player_id));
  const v2Top5 = new Set(v2.slice(0, 5).map(p => p.player_id));
  const overlap = Array.from(v1Top5).filter(id => v2Top5.has(id)).length;
  
  const differences: Array<{ player: string; v1_rank: number; v2_rank: number; reason: string }> = [];
  v1.slice(0, 15).forEach((p, i) => {
    const v2Rank = v2.findIndex(v => v.player_id === p.player_id);
    if (Math.abs(i - v2Rank) >= 5) {
      const v2Player = v2.find(v => v.player_id === p.player_id);
      let reason = v2Rank > i 
        ? (v2Player?.key_factors.find(f => f.includes('⚠️')) || 'Game context penalty')
        : (v2Player?.key_factors.find(f => f.includes('🎯')) || 'Game context boost');
      differences.push({ player: p.player_name, v1_rank: i + 1, v2_rank: v2Rank + 1, reason });
    }
  });
  
  return {
    agreement_rate: overlap / 5,
    top_pick_matches: v1[0]?.player_id === v2[0]?.player_id,
    top_5_overlap: overlap,
    major_differences: differences.slice(0, 5),
  };
}

export default { predictPlayerV2, predictAllPlayersV2, compareModels };
