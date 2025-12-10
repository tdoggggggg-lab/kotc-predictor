// King of the Court Scoring Models
import { EnhancedPlayerData } from './espn-data';
import { getInjuryScoreAdjustment, shouldExcludePlayer, InjuryStatus } from './injuries';

export interface ScoredPlayer extends EnhancedPlayerData {
  v1_score: number;
  v2_score: number;
  stats_score: number;
  context_score: number;
  injury_adjustment: number;
  rank_v1?: number;
  rank_v2?: number;
  rank_change?: number;
}

// V1: Stats-focused (75% stats, 25% context)
// V2: Context-focused (25% stats, 75% context) - prioritizes matchups, pace, game environment

export function scorePlayersV1(players: EnhancedPlayerData[]): ScoredPlayer[] {
  return players.map(p => {
    const statsScore = calculateStatsScore(p);
    const contextScore = calculateContextScore(p);
    const injuryAdj = getInjuryScoreAdjustment(p.injury_status || 'HEALTHY');
    
    // V1: Heavy stats weighting
    const v1Score = (statsScore * 0.75) + (contextScore * 0.25) + injuryAdj;
    
    return {
      ...p,
      v1_score: v1Score,
      v2_score: 0, // Will be filled by V2
      stats_score: statsScore,
      context_score: contextScore,
      injury_adjustment: injuryAdj
    };
  });
}

export function scorePlayersV2(players: EnhancedPlayerData[]): ScoredPlayer[] {
  return players.map(p => {
    const statsScore = calculateStatsScore(p);
    const contextScore = calculateContextScore(p);
    const injuryAdj = getInjuryScoreAdjustment(p.injury_status || 'HEALTHY');
    
    // V2: Heavy context weighting
    const v2Score = (statsScore * 0.25) + (contextScore * 0.75) + injuryAdj;
    
    return {
      ...p,
      v1_score: 0, // Will be filled by V1
      v2_score: v2Score,
      stats_score: statsScore,
      context_score: contextScore,
      injury_adjustment: injuryAdj
    };
  });
}

function calculateStatsScore(p: EnhancedPlayerData): number {
  // Points dominate in KOTC
  const pointsScore = p.ppg * 2.5;
  
  // Rebounds and assists matter but less
  const reboundsScore = p.rpg * 1.2;
  const assistsScore = p.apg * 1.0;
  
  // Efficiency bonus
  const efficiencyBonus = (p.fgp > 0.5 ? 5 : 0) + (p.fgp > 0.55 ? 5 : 0);
  
  return pointsScore + reboundsScore + assistsScore + efficiencyBonus;
}

function calculateContextScore(p: EnhancedPlayerData): number {
  let score = 50; // Base score
  
  // Defensive matchup (higher opp_def_rating = weaker D = better for player)
  const defenseBonus = (p.opp_def_rating - 110) * 1.5;
  score += defenseBonus;
  
  // Pace impact (higher pace = more possessions)
  const paceBonus = (p.pace - 99) * 1.2;
  score += paceBonus;
  
  // Home court advantage
  if (p.is_home) {
    score += 3;
  }
  
  // Back-to-back adjustments
  if (p.is_b2b) {
    score -= 8; // Player's team fatigued
  }
  if (p.opponent_b2b) {
    score += 6; // Opponent fatigued = advantage
  }
  
  // Spread context
  if (p.spread !== null) {
    if (p.spread < -5) {
      score += 4; // Big favorite
    } else if (p.spread < 0) {
      score += 2; // Small favorite
    } else if (p.spread > 5) {
      score -= 3; // Big underdog
    }
  }
  
  // Over/under context
  if (p.over_under !== null) {
    if (p.over_under > 230) {
      score += 6;
    } else if (p.over_under > 220) {
      score += 3;
    } else if (p.over_under < 210) {
      score -= 3;
    }
  }
  
  return score;
}

export function rankPlayers(
  players: EnhancedPlayerData[],
  modelVersion: 'v1' | 'v2' | 'both' = 'both'
): { v1: ScoredPlayer[], v2: ScoredPlayer[], comparison: ModelComparison } {
  const v1Scored = scorePlayersV1(players);
  const v2Scored = scorePlayersV2(players);
  
  // Merge scores
  const merged = v1Scored.map((p, i) => ({
    ...p,
    v2_score: v2Scored[i].v2_score
  }));
  
  // Sort by V1
  const v1Ranked = [...merged].sort((a, b) => b.v1_score - a.v1_score);
  v1Ranked.forEach((p, i) => p.rank_v1 = i + 1);
  
  // Sort by V2
  const v2Ranked = [...merged].sort((a, b) => b.v2_score - a.v2_score);
  v2Ranked.forEach((p, i) => p.rank_v2 = i + 1);
  
  // Calculate rank changes
  const rankedMap = new Map<string, ScoredPlayer>();
  v1Ranked.forEach(p => {
    const v2Player = v2Ranked.find(v2 => v2.player_id === p.player_id);
    p.rank_change = (p.rank_v1 || 0) - (v2Player?.rank_v2 || 0);
    rankedMap.set(p.player_id, p);
  });
  
  // Create comparison stats
  const comparison = generateComparison(v1Ranked, v2Ranked);
  
  return { v1: v1Ranked, v2: v2Ranked, comparison };
}

export interface ModelComparison {
  total_players: number;
  rank_changes: number;
  biggest_riser: { name: string; change: number } | null;
  biggest_faller: { name: string; change: number } | null;
  top5_overlap: number;
  avg_rank_change: number;
}

function generateComparison(v1: ScoredPlayer[], v2: ScoredPlayer[]): ModelComparison {
  const rankChanges = v1.filter(p => p.rank_change !== 0).length;
  
  let biggestRiser: { name: string; change: number } | null = null;
  let biggestFaller: { name: string; change: number } | null = null;
  let totalChange = 0;
  
  for (const p of v1) {
    const change = p.rank_change || 0;
    totalChange += Math.abs(change);
    
    if (change > 0 && (!biggestRiser || change > biggestRiser.change)) {
      biggestRiser = { name: p.name, change };
    }
    if (change < 0 && (!biggestFaller || change < biggestFaller.change)) {
      biggestFaller = { name: p.name, change };
    }
  }
  
  // Check top 5 overlap
  const v1Top5 = new Set(v1.slice(0, 5).map(p => p.player_id));
  const v2Top5 = new Set(v2.slice(0, 5).map(p => p.player_id));
  const top5Overlap = Array.from(v1Top5).filter(id => v2Top5.has(id)).length;
  
  return {
    total_players: v1.length,
    rank_changes: rankChanges,
    biggest_riser: biggestRiser,
    biggest_faller: biggestFaller,
    top5_overlap: top5Overlap,
    avg_rank_change: v1.length > 0 ? totalChange / v1.length : 0
  };
}
